/**
 * Tipos de la opinión del gato.
 *
 * Se declaran aparte para que `memory.ts`, `opinion.ts` y `nahualada.ts`
 * compartan el mismo contrato sin importarse en círculo.
 */
export interface Opinion {
  /** La confesión completa, empezando por "Mi opinión sobre mi humano:". */
  quote: string;
  ts: string;
  /** Tokens que costó rumiar (para el presupuesto diario). */
  tokens?: number;
}
