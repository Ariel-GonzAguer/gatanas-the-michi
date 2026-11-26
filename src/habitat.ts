/**
 * El hábitat de Gatanás: su Sprite.
 *
 * Dos poderes distintos, dos clientes distintos:
 *  - `SpritesApi` habla con el plano de control (checkpoints, servicios, exec)
 *    autenticado con el token de la organización.
 *  - `Voice` habla con el gateway de conectores, que reconoce al Sprite por su
 *    identidad de Fly y nunca le pasa el token de OpenRouter.
 *
 * El gato tiene el primer poder solo mientras la persona se lo presta; el
 * segundo lo tiene por haber nacido aquí.
 */
import type { ModelTask } from "./config.js";

export interface SpriteSummary {
  name: string;
  status: string;
  url: string;
}

export interface SpriteService {
  name: string;
  cmd?: string;
  args?: string[];
  http_port?: number;
  state?: { status?: string; pid?: number; restart_count?: number };
}

export interface Checkpoint {
  id: string;
  comment?: string;
  created_at: string;
}

export class SpritesApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null,
    private readonly spriteName: string,
  ) {}

  get canManage(): boolean {
    return Boolean(this.token);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.token) throw new Error("Gatanás has no key to the control plane");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Sprites ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async listServices(): Promise<SpriteService[]> {
    const data = await this.call<{ services?: SpriteService[] }>(
      "GET",
      `/v1/sprites/${this.spriteName}/services`,
    );
    return Array.isArray(data.services) ? data.services : [];
  }

  async restartService(name: string): Promise<void> {
    await this.call(
      "POST",
      `/v1/sprites/${this.spriteName}/services/${encodeURIComponent(name)}/restart`,
    );
  }

  async exec(command: string): Promise<{ status: number; stdout: string }> {
    const url = `${this.baseUrl}/v1/sprites/${this.spriteName}/exec?cmd=bash&cmd=-c&cmd=${encodeURIComponent(command)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return { status: res.status, stdout: await res.text() };
  }

  async readFile(filePath: string): Promise<string> {
    const clean = filePath.replace(/^\/+/, "");
    const res = await fetch(`${this.baseUrl}/v1/sprites/${this.spriteName}/filesystem/${clean}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw new Error(`Couldn't read ${filePath}: ${res.status}`);
    return res.text();
  }

  async createCheckpoint(comment: string): Promise<Checkpoint> {
    const data = await this.call<{ checkpoint?: Checkpoint; id?: string; created_at?: string }>(
      "POST",
      `/v1/sprites/${this.spriteName}/checkpoints`,
      { comment },
    );
    if (data.checkpoint) return data.checkpoint;
    return { id: data.id ?? "", created_at: data.created_at ?? new Date().toISOString(), comment };
  }

  async listCheckpoints(): Promise<Checkpoint[]> {
    const data = await this.call<{ checkpoints?: Checkpoint[] }>(
      "GET",
      `/v1/sprites/${this.spriteName}/checkpoints`,
    );
    return Array.isArray(data.checkpoints) ? data.checkpoints : [];
  }

  async restoreCheckpoint(id: string): Promise<void> {
    await this.call("POST", `/v1/sprites/${this.spriteName}/checkpoints/${encodeURIComponent(id)}/restore`);
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface VoiceReply {
  content: string;
  tokens: number;
  cost: number;
}

/**
 * La voz de Gatanás: OpenRouter a través del gateway.
 *
 * `baseUrl` debe apuntar al gateway, no a la API: el gateway autentica por
 * identidad del Sprite y adjunta la llave guardada. Si el gato no está en su
 * Sprite, esto falla con 401 — y es correcto: fuera de casa, no habla.
 *
 * Para el chat, la voz tiene una cadena: primero los modelos `:free`
 * (compartidos, a veces saturados) y al final el modelo pagado. Así el gato
 * conversa gratis cuando puede y no se queda mudo cuando no.
 */
export class Voice {
  constructor(
    private readonly gatewayBase: string,
    private readonly connectionId: string,
    private readonly models: Record<ModelTask, string>,
    private readonly timeoutMs: number,
    private readonly chatFallbacks: readonly string[] = [],
  ) {}

  get base(): string {
    return `${this.gatewayBase}/openrouter/${this.connectionId}`;
  }

  async reachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayBase}/list`, { signal: timeoutSignal(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** ¿Existe el modelo con el que el gato piensa? Si no, se puede elegir otro. */
  async hasModel(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/v1/models`, { signal: timeoutSignal(8000) });
      if (!res.ok) return false;
      const json = (await res.json()) as { data?: { id: string }[] };
      return (json.data ?? []).some((m) => m.id === id);
    } catch {
      return false;
    }
  }

  async chat(
    task: ModelTask,
    messages: ChatMessage[],
    opts: { json?: boolean; temperature?: number; maxTokens?: number; model?: string } = {},
  ): Promise<VoiceReply> {
    const primary = opts.model ?? this.models[task];
    // Cadena de chat: primero el modelo asignado, luego los free, y el pagado
    // de último. Cada eslabón aguanta los fallos del anterior (429 upstream,
    // respuestas vacías de modelos que razonan).
    const chain =
      task === "chat" && this.chatFallbacks.length > 0
        ? [primary, ...this.chatFallbacks.filter((m) => m !== primary)]
        : [primary];
    let lastError: unknown = null;
    for (const model of chain) {
      try {
        return await this.chatOnce(model, messages, opts);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("no model answered");
  }

  private async chatOnce(
    model: string,
    messages: ChatMessage[],
    opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
  ): Promise<VoiceReply> {
    const requested = opts.maxTokens ?? 700;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.9,
      // Varios modelos razonan antes de hablar: si el presupuesto es corto, se
      // lo gastan pensando y devuelven `content: null`. El margen extra no
      // cuesta cuando no se usa, así que va siempre.
      max_tokens: requested + REASONING_HEADROOM,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutSignal(this.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`OpenRouter gateway answered ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as {
      choices?: {
        finish_reason?: string;
        message?: { content?: string | null; reasoning?: string | null };
      }[];
      usage?: { total_tokens?: number; cost?: number };
    };
    const choice = json.choices?.[0];
    const content = choice?.message?.content ?? "";
    // Si el modelo se quedó sin presupuesto razonando, es un fallo nuestro,
    // no una respuesta vacía: que el llamador pueda responder con su
    // repertorio de emergencia en vez de maullar un punto.
    if (!content.trim()) {
      throw new Error(
        `empty reply from ${model} (finish_reason=${choice?.finish_reason ?? "?"}, tokens=${json.usage?.total_tokens ?? 0})`,
      );
    }
    return {
      content,
      tokens: json.usage?.total_tokens ?? 0,
      cost: json.usage?.cost ?? 0,
    };
  }
}

/** Margen para el monólogo interno de los modelos que razonan. */
const REASONING_HEADROOM = 2200;

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}
