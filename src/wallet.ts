/**
 * El monedero felino.
 *
 * La API key de OpenRouter de esta casa tiene un tope de 6.66 USD. Gatanás lo
 * sabe y caza con hambre medida: además del tope de tokens por día, mira el
 * gasto real que reporta OpenRouter en cada respuesta y se frena solo cuando
 * el total se acerca al límite de la llave.
 *
 * Un gato que gasta más de lo que su humano le dio no merece atún.
 */
import type { GatanasConfig } from "./config.js";
import type { Memory } from "./memory.js";

export const DEFAULT_KEY_CAP_USD = 6.66;

/** Lo que el monedero necesita: gasto acumulado, tope y reserva. */
export interface WalletState {
  /** Gasto total del gato desde que nació (estimado por respuestas). */
  spentUsd: number;
  /** Tope de la llave, en USD. */
  capUsd: number;
  /** Tope de gasto por día, en USD. */
  dailyCapUsd: number;
  /** Gasto de hoy. */
  spentTodayUsd: number;
}

export class Wallet {
  /** Margen de seguridad: el gato deja algo para el postre. */
  static readonly RESERVE_USD = 0.5;

  constructor(
    private readonly cfg: GatanasConfig,
    private readonly memory: Memory,
    private readonly capUsd: number = DEFAULT_KEY_CAP_USD,
  ) {}

  get spentTotal(): number {
    return this.memory.spentUsd;
  }

  get spentToday(): number {
    return this.memory.spentTodayUsd();
  }

  state(): WalletState {
    return {
      spentUsd: this.spentTotal,
      capUsd: this.capUsd,
      dailyCapUsd: this.cfg.dailyBudgetUsd,
      spentTodayUsd: this.spentToday,
    };
  }

  /** ¿Puede gastar ahora? Devuelve el motivo cuando no. */
  canSpend(): { ok: boolean; reason?: string } {
    if (this.spentToday >= this.cfg.dailyBudgetUsd) {
      return { ok: false, reason: `presupuesto de hoy agotado (${this.spentToday.toFixed(3)} USD)` };
    }
    if (this.spentTotal >= this.capUsd - Wallet.RESERVE_USD) {
      return {
        ok: false,
        reason: `la llave está casi en su tope (${this.spentTotal.toFixed(2)} de ${this.capUsd} USD). El gato ayuna.`,
      };
    }
    return { ok: true };
  }

  /** Registra el costo que reportó OpenRouter. */
  charge(usd: number, tokens: number): void {
    if (usd > 0) this.memory.recordCharge(usd);
    if (tokens > 0) this.memory.recordTokens(tokens);
  }

  /** Narrativa del monedero para el altar. */
  static mood(s: WalletState): string {
    const left = s.capUsd - s.spentUsd;
    if (left < 1) return "Gatanás come poco: la llave de OpenRouter está por acabarse.";
    if (left < 3) return "Gatanás come moderado: queda presupuesto de caza.";
    return "Gatanás come bien: hay presupuesto para noches largas.";
  }
}
