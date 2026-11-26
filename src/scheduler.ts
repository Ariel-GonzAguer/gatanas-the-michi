/**
 * El pulso del gato.
 *
 * Separado del servidor para poder probarse sin abrir puertos. Cuatro
 * pulsos, todos idempotentes:
 *  - cacería: cada `huntIntervalSec` (0 = nunca),
 *  - sonda de vigilia: cada 30 s, para saber si el gato sigue vivo,
 *  - rumia: una vez al día si hay presupuesto,
 *  - nahualada: si el gato despierta en modo "me estoy restaurando", se
 *    queda quieto un rato y luego vuelve.
 */
import type { GatanasConfig } from "./config.js";
import type { HuntEngine } from "./hunt.js";
import type { Memory } from "./memory.js";
import { ruminate, shouldRuminate } from "./opinion.js";
import type { Voice } from "./habitat.js";
import type { Wallet } from "./wallet.js";

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export interface SchedulerDeps {
  cfg: GatanasConfig;
  memory: Memory;
  voice: Voice | null;
  wallet: Wallet;
  hunt: HuntEngine;
  now: () => number;
  nowIso: () => string;
}

export class Scheduler {
  private timers: NodeJS.Timeout[] = [];
  private running = false;
  private nahualadaUntilMs = 0;

  constructor(private readonly d: SchedulerDeps) {}

  get isAlive(): boolean {
    const last = this.d.memory.state.lastWatchAt;
    if (!last) return false;
    return this.d.now() - Date.parse(last) < 90_000;
  }

  get inNahualada(): boolean {
    return this.d.now() < this.nahualadaUntilMs;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // El gato se reconoce al despertar: ¿desapareció su acta? ¿estaba en
    // medio de una restauración? Lo deja en el log y en el acta.
    const st = this.d.memory.state;
    if (st.lifeEvents.some((e) => e.kind === "restored")) {
      const last = [...st.lifeEvents].reverse().find((e) => e.kind === "restored");
      if (last && this.d.now() - Date.parse(last.at) < 120_000 && st.livesRemaining > 0) {
        this.nahualadaUntilMs = this.d.now() + 20_000;
        log("nahualada: desperté de una restauración. Me tomo veinte segundos para recordar quién soy.");
      }
    }

    await this.beat();
    this.every(30_000, () => this.beat());
    if (this.d.cfg.huntIntervalSec > 0) {
      // Primera cacería al minuto de despertar: si es un Sprite recién nacido,
      // ya hay caja de arena que mirar.
      setTimeout(() => void this.huntNow("cron"), 60_000).unref();
      this.every(this.d.cfg.huntIntervalSec * 1000, () => void this.huntNow("cron"));
    }
    // Rumia: revisa cada hora si ya amaneció un día nuevo.
    this.every(3_600_000, () => void this.maybeRuminate());
    void this.maybeRuminate();
    log(`pulso iniciado: cacería cada ${this.d.cfg.huntIntervalSec}s, vidas ${this.d.memory.state.livesRemaining}.`);
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.running = false;
  }

  private every(ms: number, fn: () => void | Promise<void>): void {
    const t = setInterval(() => {
      void fn();
    }, ms);
    t.unref?.();
    this.timers.push(t);
  }

  async beat(): Promise<void> {
    this.d.memory.recordWatch();
    await this.d.memory.save();
  }

  async huntNow(source: "cron" | "manual" | "request" = "manual"): Promise<Awaited<ReturnType<HuntEngine["hunt"]>> | null> {
    if (this.inNahualada) {
      log("estoy en nahualada: no cazo, no hablo, no existo del todo. Probá en un rato.");
      return null;
    }
    return this.d.hunt.hunt(source);
  }

  async maybeRuminate(): Promise<void> {
    const nowIso = this.d.nowIso();
    const purse = this.d.wallet.canSpend();
    const input = {
      memory: this.d.memory.state,
      nowIso,
      purrDrought: this.d.memory.purrDrought(nowIso),
      budgetLeft: purse.ok ? 1 : 0,
    };
    if (!shouldRuminate(input)) return;
    const opinion = await ruminate(this.d.voice, input);
    if (!opinion) return;
    this.d.wallet.charge(0, opinion.tokens ?? 0);
    await this.d.memory.update((m) => {
      m.opinion = { quote: opinion.quote, ts: opinion.ts, tokens: opinion.tokens ?? 0 };
    });
    log("rumia guardada. El altar ya tiene la opinión del gato.");
  }

  /** El humano le ordena al gato tirar algo de la mesa y revivir. */
  async performNahualada(reason: string): Promise<string> {
    const ok = this.d.memory.state.livesRemaining > 0;
    if (!ok) return "No me quedan vidas. Ni modo. miau.";
    this.nahualadaUntilMs = this.d.now() + 20_000;
    await this.d.memory.save();
    return `Me tiré de la mesa a propósito (${reason}). Estoy reviviendo: veinte segundos de silencio y vuelvo. Que conste.`;
  }
}

/** Saludo del gato visto desde fuera. */
export function restGreeting(name: string): string {
  return `Soy ${name}. Vivo en este Sprite. No estoy despierto ahora, pero mi altar sí. miau.`;
}
