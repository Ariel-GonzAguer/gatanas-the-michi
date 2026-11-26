/**
 * El acta de Gatanás.
 *
 * Todo lo que el gato recuerda vive en un JSON pequeño en su disco
 * persistente. Los Sprites conservan el disco entre sueños, así que el gato
 * despierta recordando cada regalo, cada vida gastada y cada caricia.
 *
 * Las escrituras van a un archivo temporal y luego se renombran: si el Sprite
 * se apaga a mitad de una nahualada, el acta sigue legible.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Gift } from "./prey.js";
import type { Opinion } from "./opinion-types.js";

export type LifeKind = "born" | "sacrificed" | "restored" | "reincarnated";

export interface LifeEvent {
  kind: LifeKind;
  id: string;
  at: string;
  reason: string;
  checkpointIds?: string[];
  /** Estado del gato en ese momento, para narrarlo en el altar. */
  kills?: number;
  gift?: string;
}

/** Los checkpoints que el gato tomó, para poder restaurarlos. */
export interface CheckpointRef {
  id: string;
  comment: string;
  at: string;
}

export interface GatanasMemory {
  schema: 1;
  createdAt: string;
  name: string;
  /** Regalos, el más reciente primero. */
  gifts: Gift[];
  /** Vidas: cuántas quedan y el historial de cómo se fueron. */
  livesRemaining: number;
  lifeEvents: LifeEvent[];
  /** Checkpoints conocidos, listos para gastar en una restauración. */
  checkpoints: CheckpointRef[];
  /** Caricias acumuladas. Ningún gato sobrevive sin ellas. */
  purrs: number;
  lastPurrAt: string | null;
  /** Rondas de cacería. */
  hunts: number;
  lastHuntAt: string | null;
  lastHuntFound: number;
  /** Sondas de vigilia: si el gato ya no las escribe, está en trance. */
  watches: number;
  lastWatchAt: string | null;
  /** Títulos que el narrador le ha ido regalando a quien mantiene el Sprite. */
  humanTitles: string[];
  /** Lo que Gatanás confiesa en el altar. */
  opinion: (Opinion & { tokens?: number }) | null;
  /** Consumo de tokens por día, para el presupuesto de OpenRouter. */
  tokensByDay: Record<string, number>;
  /** Gasto real en USD (lo que reporta OpenRouter), por día. */
  usdByDay: Record<string, number>;
  /** Gasto acumulado desde que nació. */
  spentUsd: number;
  /** Registro de presas ya entregadas (para no repetir el regalo el mismo día). */
  giftedKeys: Record<string, string>;
}

const EMPTY = (name: string, lives = 9): GatanasMemory => ({
  schema: 1,
  createdAt: new Date().toISOString(),
  name,
  gifts: [],
  livesRemaining: lives,
  lifeEvents: [],
  checkpoints: [],
  purrs: 0,
  lastPurrAt: null,
  hunts: 0,
  lastHuntAt: null,
  lastHuntFound: 0,
  watches: 0,
  lastWatchAt: null,
  humanTitles: [],
  opinion: null,
  tokensByDay: {},
  usdByDay: {},
  spentUsd: 0,
  giftedKeys: {},
});

export class Memory {
  private data: GatanasMemory = EMPTY("Gatanás The Michi");
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly fallbackName = "Gatanás The Michi",
    private readonly altarCapacity = 200,
    private readonly lives = 9,
  ) {}

  get path(): string {
    return this.file;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<GatanasMemory> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<GatanasMemory>;
      this.data = { ...EMPTY(this.fallbackName, this.lives), ...parsed } as GatanasMemory;
      if (!Array.isArray(this.data.gifts)) this.data.gifts = [];
      if (!Array.isArray(this.data.lifeEvents)) this.data.lifeEvents = [];
      if (!Array.isArray(this.data.checkpoints)) this.data.checkpoints = [];
      if (!Array.isArray(this.data.humanTitles)) this.data.humanTitles = [];
      if (!this.data.usdByDay) this.data.usdByDay = {};
      if (typeof this.data.spentUsd !== "number") {
        this.data.spentUsd = Object.values(this.data.usdByDay).reduce((a, b) => a + b, 0);
      }
      this.data.schema = 1;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        // Acta corrupta: el gato la deja a un lado en vez de borrarla.
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.rename(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => {});
      }
      this.data = EMPTY(this.fallbackName, this.lives);
      this.data.lifeEvents.push({
        kind: "born",
        id: "born",
        at: new Date().toISOString(),
        reason: "Nació en un Sprite de Fly.io y maulló por primera vez.",
      });
      this.loaded = true;
      await this.save();
      return this.data;
    }
    this.loaded = true;
    return this.data;
  }

  get state(): GatanasMemory {
    if (!this.loaded) throw new Error("El acta no ha sido leída todavía");
    return this.data;
  }

  async save(): Promise<void> {
    const payload = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, payload, "utf8");
      await fs.rename(tmp, this.file);
    });
    await this.writeQueue;
  }

  async update(fn: (m: GatanasMemory) => void): Promise<GatanasMemory> {
    fn(this.data);
    await this.save();
    return this.data;
  }

  addGift(gift: Gift): void {
    this.data.gifts.unshift(gift);
    if (this.data.gifts.length > this.altarCapacity) {
      this.data.gifts.length = this.altarCapacity;
    }
  }

  recordTokens(tokens: number): void {
    if (tokens <= 0) return;
    const day = new Date().toISOString().slice(0, 10);
    this.data.tokensByDay[day] = (this.data.tokensByDay[day] ?? 0) + tokens;
  }

  recordCharge(usd: number): void {
    if (usd <= 0) return;
    const day = new Date().toISOString().slice(0, 10);
    this.data.usdByDay[day] = (this.data.usdByDay[day] ?? 0) + usd;
    this.data.spentUsd = (this.data.spentUsd ?? 0) + usd;
  }

  get spentUsd(): number {
    return this.data.spentUsd;
  }

  tokensToday(): number {
    return this.data.tokensByDay[new Date().toISOString().slice(0, 10)] ?? 0;
  }

  spentTodayUsd(): number {
    return this.data.usdByDay[new Date().toISOString().slice(0, 10)] ?? 0;
  }

  purr(): number {
    this.data.purrs += 1;
    this.data.lastPurrAt = new Date().toISOString();
    return this.data.purrs;
  }

  recordWatch(): void {
    this.data.watches += 1;
    this.data.lastWatchAt = new Date().toISOString();
  }

  recordHunt(found: number): void {
    this.data.hunts += 1;
    this.data.lastHuntAt = new Date().toISOString();
    this.data.lastHuntFound = found;
  }

  setOpinion(opinion: Opinion): void {
    this.data.opinion = { quote: opinion.quote, ts: opinion.ts, tokens: opinion.tokens ?? 0 };
  }

  /** Días desde la última caricia (o desde que nació). */
  purrDrought(nowIso: string): number {
    const ref = this.data.lastPurrAt ?? this.data.createdAt;
    const days = (Date.parse(nowIso) - Date.parse(ref)) / 86_400_000;
    return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
  }
}
