/**
 * Las nueve vidas de Gatanás.
 *
 * Cada vida es una restauración desde un checkpoint del Sprite. El gato
 * consume una vida cuando algo se rompe de verdad: tiró algo de la mesa, o el
 * humano se lo pidió.
 *
 * Detalle del oficio: restaurar un checkpoint rebobina el disco, y por lo
 * tanto también esta acta. Por eso el gato anota todo antes de restaurar y,
 * después, reconcilia el acta con lo que había escrito.
 */
import type { GatanasConfig } from "./config.js";
import type { Checkpoint, SpritesApi } from "./habitat.js";
import type { CheckpointRef, LifeEvent, Memory } from "./memory.js";

export interface LifeState {
  livesRemaining: number;
  lives: number;
  lastCheckpoint: CheckpointRef | null;
  events: LifeEvent[];
}

export class NineLives {
  constructor(
    private readonly cfg: GatanasConfig,
    private readonly memory: Memory,
    private readonly api: SpritesApi | null,
  ) {}

  get state(): LifeState {
    const m = this.memory.state;
    return {
      livesRemaining: m.livesRemaining,
      lives: this.cfg.lives,
      lastCheckpoint: m.checkpoints[m.checkpoints.length - 1] ?? null,
      events: m.lifeEvents,
    };
  }

  canManage(): boolean {
    return Boolean(this.api && this.api.canManage);
  }

  /** Toma un checkpoint y lo guarda para poder restaurarlo. */
  async takeCheckpoint(comment: string): Promise<CheckpointRef | null> {
    if (!this.api || !this.api.canManage) return null;
    try {
      const cp: Checkpoint = await this.api.createCheckpoint(comment.slice(0, 200));
      if (!cp.id) return null;
      const ref: CheckpointRef = { id: cp.id, comment: cp.comment ?? comment, at: cp.created_at ?? new Date().toISOString() };
      await this.memory.update((m) => {
        m.checkpoints.push(ref);
        if (m.checkpoints.length > 20) m.checkpoints.splice(0, m.checkpoints.length - 20);
      });
      return ref;
    } catch {
      return null;
    }
  }

  /** Carga un checkpoint listo para gastar (lo toma ahora mismo). */
  async prepareLife(reason: string): Promise<CheckpointRef | null> {
    return this.takeCheckpoint(reason);
  }

  /**
   * Gasta una vida: restaura el último checkpoint, o el indicado.
   *
   * Devuelve el evento para que quien mire pueda narrarlo.
   */
  async spendLife(reason: string, checkpointId?: string): Promise<LifeEvent | null> {
    const m = this.memory.state;
    if (m.livesRemaining <= 0) return null;
    if (!this.api || !this.api.canManage) return null;

    const target =
      checkpointId ??
      (m.checkpoints[m.checkpoints.length - 1]?.id ||
        (await this.takeCheckpoint(`Before: ${reason}`))?.id);
    if (!target) return null;

    const event: LifeEvent = {
      kind: "restored",
      id: target,
      at: new Date().toISOString(),
      reason,
      checkpointIds: [target],
      kills: m.gifts.length,
    };

    // Todo lo que hay que sobrevivir al rebobinado se guarda primero.
    await this.memory.update((mm) => {
      mm.livesRemaining = Math.max(0, mm.livesRemaining - 1);
      mm.lifeEvents.push(event);
    });
    const before = JSON.stringify(m.checkpoints);

    try {
      await this.api.restoreCheckpoint(target);
    } catch (err) {
      // La vida no se gastó: se devuelve.
      await this.memory.update((mm) => {
        mm.livesRemaining = Math.min(this.cfg.lives, mm.livesRemaining + 1);
        const idx = mm.lifeEvents.findIndex((e) => e === event || (e.id === event.id && e.at === event.at));
        if (idx >= 0) mm.lifeEvents.splice(idx, 1);
      });
      throw err;
    }

    await this.memory.update((mm) => {
      mm.checkpoints = JSON.parse(before) as CheckpointRef[];
      const restored = mm.lifeEvents.filter((e) => e.kind === "restored");
      // Si el disco traía una acta vieja, la vida se vuelve a registrar.
      if (!restored.some((e) => e.id === event.id && e.at === event.at)) mm.lifeEvents.push(event);
    });
    return event;
  }

  /** Registra una vida perdida por accidente (el gato tiró algo de la mesa). */
  async loseLife(reason: string): Promise<LifeEvent | null> {
    const m = this.memory.state;
    if (m.livesRemaining <= 0) return null;
    const event: LifeEvent = {
      kind: "sacrificed",
      id: `lost-${Date.now()}`,
      at: new Date().toISOString(),
      reason,
      kills: m.gifts.length,
    };
    await this.memory.update((mm) => {
      mm.livesRemaining = Math.max(0, mm.livesRemaining - 1);
      mm.lifeEvents.push(event);
    });
    return event;
  }

  /** Renacimiento: nueve vidas nuevas, misma alma. No borra los regalos. */
  async reincarnate(reason: string): Promise<LifeEvent> {
    const event: LifeEvent = {
      kind: "reincarnated",
      id: `reborn-${Date.now()}`,
      at: new Date().toISOString(),
      reason,
      kills: this.memory.state.gifts.length,
    };
    await this.memory.update((mm) => {
      mm.livesRemaining = this.cfg.lives;
      mm.lifeEvents.push(event);
    });
    return event;
  }

  /** Narrativa del altar. */
  static narrative(e: LifeEvent): string {
    switch (e.kind) {
      case "born":
        return `Life ${e.id.slice(0, 6)}: Gatanás took a checkpoint. This is where it remembers being whole.`;
      case "sacrificed":
        return `Gatanás knocked something off the table (${e.reason}). It closed its eyes. One life fewer.`;
      case "restored":
        return `Gatanás came back from ${e.id.slice(0, 6)}: ${e.reason}. It won't confirm it enjoyed it.`;
      case "reincarnated":
        return `Nine brand-new lives again. ${e.reason}`;
    }
  }
}

/** Para la prueba: un SpritesApi falso con checkpoints en memoria. */
export function fakeSpritesApi(opts: { fail?: boolean } = {}): SpritesApi {
  let n = 0;
  return {
    canManage: true,
    async createCheckpoint(comment: string) {
      n += 1;
      return { id: `cp-${n}`, comment, created_at: new Date().toISOString() };
    },
    async restoreCheckpoint(id: string) {
      if (opts.fail) throw new Error(`couldn't restore ${id}`);
    },
    async listServices() { return []; },
    async restartService() {},
    async exec() { return { status: 0, stdout: "" }; },
    async readFile() { return ""; },
    async listCheckpoints() { return []; },
  } as unknown as SpritesApi;
}
