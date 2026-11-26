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
    if (!this.token) throw new Error("Gatanás no tiene llave del plano de control");
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
    if (!res.ok) throw new Error(`No pude leer ${filePath}: ${res.status}`);
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
 */
export class Voice {
  constructor(
    private readonly gatewayBase: string,
    private readonly connectionId: string,
    private readonly models: Record<ModelTask, string>,
    private readonly timeoutMs: number,
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
    const model = opts.model ?? this.models[task];
    const requested = opts.maxTokens ?? 700;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.9,
      // GLM 5.3 Flash razona antes de hablar: si el presupuesto es corto, se
      // lo gasta pensando y devuelve `content: null`. Le damos espacio para
      // el monólogo interno más la respuesta.
      max_tokens: isReasoning(model) ? requested + REASONING_HEADROOM : requested,
    };
    if (opts.json) body.response_format = { type: "json_object" };
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeoutSignal(this.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`El gateway de OpenRouter respondió ${res.status}: ${text.slice(0, 300)}`);
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
        `respuesta vacía (finish_reason=${choice?.finish_reason ?? "?"}, tokens=${json.usage?.total_tokens ?? 0})`,
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
const REASONING_HEADROOM = 900;

function isReasoning(model: string): boolean {
  return /glm-5\.3|deepseek-v4|o[134]|thinking|reason/i.test(model);
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}
