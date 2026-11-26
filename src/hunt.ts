/**
 * El motor de cacería.
 *
 * Una ronda de cacería es: abrir los ojos (collect), oler lo encontrado
 * (diet), dejar el regalo (narrate) y archivarlo en el altar (memory). Todo
 * es determinista salvo la voz: por eso `HuntEngine` recibe sus colaboradores
 * por constructor y las pruebas le inyectan dobles.
 *
 * La cacería es frugal: si el veredicto es una hoja de árbol (nada que
 * arreglar), el gato no gasta un token en ponerle prosa. Las hojas se narran
 * con su propio repertorio. Los tokens son para las GPUs y los tofus.
 */
import { freshnessWindowSec, type GatanasConfig } from "./config.js";
import { collectLocalPrey, realDeps } from "./collect.js";
import { chooseGift, judgeHeuristic } from "./diet.js";
import { fallbackNarration, narrateGift } from "./narrate.js";
import type { Voice } from "./habitat.js";
import type { Memory } from "./memory.js";
import { type Gift, type Prey, type PatrolResult } from "./prey.js";
import type { Wallet } from "./wallet.js";

export interface HuntDeps {
  voice: Voice | null;
  memory: Memory;
  wallet: Wallet;
  nowIso: () => string;
  collect?: (opts: { host: string; freshSec: number }) => Promise<Prey[]>;
  log?: (msg: string) => void;
}

export interface HuntOutcome {
  ran: boolean;
  reason?: string;
  gifts: Gift[];
  found: number;
  tokens: number;
  usd: number;
  patrols: PatrolResult[];
}

export class HuntEngine {
  private lock = false;

  constructor(
    private readonly cfg: GatanasConfig,
    private readonly deps: HuntDeps,
  ) {}

  get busy(): boolean {
    return this.lock;
  }

  async hunt(source: "cron" | "manual" | "request" = "cron"): Promise<HuntOutcome> {
    if (this.lock) {
      return { ran: false, reason: "Already hunting. Don't interrupt me.", gifts: [], found: 0, tokens: 0, usd: 0, patrols: [] };
    }
    this.lock = true;
    try {
      return await this.doHunt(source);
    } finally {
      this.lock = false;
    }
  }

  private async doHunt(source: string): Promise<HuntOutcome> {
    const log = this.deps.log ?? (() => {});
    const { memory, wallet } = this.deps;
    const nowIso = this.deps.nowIso();

    const purse = wallet.canSpend();
    if (!purse.ok) {
      log(`[hunt] ${source}: the cat fasts (${purse.reason})`);
      return { ran: false, reason: purse.reason, gifts: [], found: 0, tokens: 0, usd: 0, patrols: [] };
    }

    const freshSec = freshnessWindowSec(this.cfg);
    const collect =
      this.deps.collect ??
      (async ({ freshSec: fs }) => collectLocalPrey(realDeps(), { host: "this Sprite", freshSec: fs }));

    const preyList = await collect({ host: "this Sprite", freshSec });
    const state = memory.state;

    // Dos noches con el mismo hallazgo = podredumbre. Se ve en el acta.
    for (const p of preyList) {
      if (state.giftedKeys[p.key]) p.sightings = Math.max(p.sightings, 2);
    }

    const gifts: Gift[] = [];
    let tokens = 0;
    let usd = 0;

    for (const prey of preyList) {
      if (gifts.length >= this.cfg.lives) break; // nueve presas por ronda, ni una más
      if (!wallet.canSpend().ok) break;
      if (state.giftedKeys[prey.key] === nowIso.slice(0, 10)) continue; // ya se lo trajo hoy

      const verdict = chooseGift(
        { prey, liveServices: 1, livesRemaining: state.livesRemaining },
        judgeHeuristic({ prey, liveServices: 1, livesRemaining: state.livesRemaining }),
      );

      // Una hoja de árbol no se repite: ya quedó claro que el Sprite está bien.
      if (verdict.kind === "leaf" && state.giftedKeys[prey.key]) continue;

      let narration = "";
      let advice = verdict.practical;
      let used = 0;

      if (verdict.kind === "leaf" && verdict.confidence >= 0.8) {
        // Frugalidad felina: las hojas no merecen tokens.
        narration = fallbackNarration("leaf", prey);
      } else {
        const r = await narrateGift(this.deps.voice, {
          prey,
          verdict,
          giftCount: state.gifts.length,
          livesRemaining: state.livesRemaining,
          purrs: state.purrs,
          timeOfDay: timeOfDay(nowIso),
        });
        narration = r.narration;
        advice = r.advice;
        used = r.tokens;
        tokens += used;
        usd += r.cost;
        wallet.charge(r.cost, used);
      }

      const gift: Gift = {
        id: `gift-${Date.now()}-${gifts.length}`,
        kind: verdict.kind,
        preyKey: prey.key,
        preyTitle: prey.title,
        narration,
        advice,
        huntNotes: `${verdict.reason} · confidence ${verdict.confidence.toFixed(2)}`,
        tokens: used,
        host: prey.host ?? "gatanas",
        at: nowIso,
      };
      gifts.push(gift);
      memory.addGift(gift);
      state.giftedKeys[prey.key] = nowIso.slice(0, 10);
    }

    memory.recordHunt(gifts.length);
    // Poda del registro de presas ya entregadas: 30 días.
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const [k, v] of Object.entries(state.giftedKeys)) {
      if (v < cutoff) delete state.giftedKeys[k];
    }
    await memory.save();

    log(`[hunt] ${source}: ${preyList.length} prey, ${gifts.length} gifts, ${tokens} tokens, ${usd.toFixed(4)} USD`);
    return {
      ran: true,
      gifts,
      found: preyList.length,
      tokens,
      usd,
      patrols: [{ host: "this Sprite", at: nowIso, findings: preyList, restarted: [], notes: [] }],
    };
  }
}

export function timeOfDay(iso: string): string {
  const h = new Date(iso).getUTCHours();
  if (h < 5) return "small hours";
  if (h < 11) return "morning";
  if (h < 15) return "midday";
  if (h < 19) return "afternoon";
  return "night";
}

/** Fuente para probar el motor sin tocar el disco ni la red. */
export function fixtureCollector(
  preyList: Prey[],
): (opts: { host: string; freshSec: number }) => Promise<Prey[]> {
  return async () => preyList.map((p) => ({ ...p }));
}
