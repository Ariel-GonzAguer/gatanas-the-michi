/**
 * Lo que Gatanás caza.
 *
 * Un hallazgo es cualquier cosa que el gato considera presa: un servicio
 * caído, un disco gordo, un log con errores frescos, un proceso que gime.
 * `collect.ts` los recolecta; `diet.ts` los convierte en regalos.
 */

export type PreyCategory =
  | "process"
  | "disk"
  | "memory"
  | "service"
  | "log"
  | "certificate"
  | "arena"
  | "campaign";

export interface Prey {
  /** Huella estable del hallazgo, para no volver a traer el mismo regalo. */
  key: string;
  category: PreyCategory;
  /** Qué es, en una línea. */
  title: string;
  /** Detalle crudo (líneas de log, salida de df, etc.). */
  evidence: string;
  /** Host o servicio al que pertenece, si aplica. */
  host?: string;
  /** Cuántas veces lo ha visto el gato (noches seguidas = podrido). */
  sightings: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type GiftKind = "gpu" | "leaf" | "tofu";

export interface Gift {
  id: string;
  kind: GiftKind;
  /** Qué lo causó. */
  preyKey: string | null;
  preyTitle: string;
  /** La prosa del gato, ya maullada. */
  narration: string;
  /** Un consejo utilitario, por si el humano quiere hacer el arreglo. */
  advice: string;
  /** Notas de cacería: lo que el gato hizo antes de decidir. */
  huntNotes: string;
  /** Costo en tokens de la llamada que lo decidió. */
  tokens: number;
  /** Tope: 9 vidas, 9 presas por ronda. */
  host: string;
  at: string;
  /** Id del checkpoint tomado para este regalo, si lo hubo. */
  checkpointId?: string;
  /** Cuántas vidas gastó. */
  livesSpent?: number;
  /** Si el humano ya lo rechazó (registro de gusto). */
  rejected?: boolean;
}

export interface PatrolResult {
  host: string;
  at: string;
  findings: Prey[];
  /** Cuántos servicios se reiniciaron durante esta ronda. */
  restarted: string[];
  /** Salida que el gato no supo leer pero quiso registrar. */
  notes: string[];
}

export function preyKey(category: PreyCategory, host: string, title: string): string {
  return `${category}:${host}:${title}`.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Para el terminal: emojis solo si el usuario los pidió. Un gato que ensucia
 * el stdout con cuadraditos no es un gato fino.
 */
export function giftEmoji(kind: GiftKind, unicode = true): string {
  if (!unicode) {
    switch (kind) {
      case "gpu":
        return "[GPU]";
      case "leaf":
        return "[LEAF]";
      case "tofu":
        return "[TOFU]";
    }
  }
  switch (kind) {
    case "gpu":
      return "🎁";
    case "leaf":
      return "🍂";
    case "tofu":
      return "🍥";
  }
}

/**
 * Para el altar: dibujos SVG inline. No dependen de la fuente de emoji del
 * visitante, así que se ven igual en un teléfono y en un navegador sin
 * fuentes de color.
 */
export function giftGlyph(kind: GiftKind): string {
  switch (kind) {
    case "gpu":
      // Un dado verde con pines: una GPU de verdad.
      return `<svg viewBox="0 0 40 40" class="glyph" aria-hidden="true"><rect x="6" y="10" width="28" height="20" rx="2" fill="#1c2a1c" stroke="#c9a227"/><rect x="11" y="15" width="10" height="10" fill="#c9a227" opacity=".55"/><rect x="24" y="15" width="6" height="10" fill="#8fb59a" opacity=".5"/><path d="M12 10V6M18 10V6M24 10V6M30 10V6M12 30v4M18 30v4M24 30v4M30 30v4" stroke="#c9a227" stroke-width="1.6"/></svg>`;
    case "leaf":
      // Una hoja seca con su nervadura.
      return `<svg viewBox="0 0 40 40" class="glyph" aria-hidden="true"><path d="M30 8C16 8 8 16 8 30c0 1 1 2 2 2 14 0 22-8 22-22 0-1-1-2-2-2z" fill="#3b2c1e" stroke="#8a6b4a"/><path d="M10 32C16 24 22 18 30 10" stroke="#8a6b4a" stroke-width="1.4" fill="none"/></svg>`;
    case "tofu":
      // Un cubo de tofu con su moho.
      return `<svg viewBox="0 0 40 40" class="glyph" aria-hidden="true"><path d="M8 16l12-7 12 7v12l-12 7-12-7z" fill="#dfe8d8" opacity=".85"/><path d="M8 16l12 7 12-7M20 23v12" stroke="#8fb59a" stroke-width="1.2" fill="none"/><circle cx="15" cy="19" r="2" fill="#6f8f76"/><circle cx="25" cy="21" r="1.6" fill="#6f8f76"/></svg>`;
  }
}

export function giftLabel(kind: GiftKind): string {
  switch (kind) {
    case "gpu":
      return "A GPU";
    case "leaf":
      return "A tree leaf";
    case "tofu":
      return "Fermented tofu";
  }
}
