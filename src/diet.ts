/**
 * La dieta de Gatanás: cómo decide qué regalo merece tu hallazgo.
 *
 * Regla de oro felina:
 *  - Algo útil de verdad → **una GPU** (el regalo que sabe que quieres).
 *  - Nada digno de ti → **una hoja de árbol** (inútil, pero es el gesto).
 *  - Algo podrido que no ha muerto todavía → **tofu fermentado**.
 *
 * La heurística decide sin gastar un token. El modelo solo entra si la
 * heurística duda, o para ponerle prosa felina al veredicto.
 */
import type { Prey } from "./prey.js";
import type { GiftKind } from "./prey.js";

export interface DietInput {
  prey: Prey;
  /** Cuántos servicios hay vivos en el Sprite ahora mismo. */
  liveServices: number;
  /** Cuántas vidas le quedan al gato. */
  livesRemaining: number;
  /** Nivel de café del humano (0-10). Solo afecta el tono, no el regalo. */
  humanCoffee?: number;
  /** Si el humano rechazó un regalo de este mismo tipo antes. */
  rejectedKinds?: GiftKind[];
}

export interface DietVerdict {
  kind: GiftKind;
  /** 0..1. Cuánto confía el gato en su juicio. */
  confidence: number;
  /** Por qué, en clave felina y breve. */
  reason: string;
  /** Qué regalo de verdad sugiere, si es GPU o tofu. */
  practical: string;
}

const GPU = (practical: string, reason: string, confidence = 0.9): DietVerdict => ({
  kind: "gpu",
  confidence,
  reason,
  practical,
});
const LEAF = (reason: string, confidence = 0.85): DietVerdict => ({
  kind: "leaf",
  confidence,
  reason,
  practical: "Nada que arreglar. El Sprite está bien.",
});
const TOFU = (practical: string, reason: string, confidence = 0.85): DietVerdict => ({
  kind: "tofu",
  confidence,
  reason,
  practical,
});

/**
 * Heurística: rápida, determinista y sin tokens. Devuelve `null` cuando no
 * sabe (y entonces el gato consulta a su oráculo).
 */
export function judgeHeuristic(input: DietInput): DietVerdict | null {
  const { prey, liveServices, livesRemaining } = input;
  const sightings = prey.sightings;

  if (prey.category === "process") {
    if (/zombi/.test(prey.title)) {
      return sightings >= 3
        ? TOFU("Kill del padre o reinicio del servicio que los creó.", "Zombis de varias noches. Huelen.")
        : LEAF("Un zombi recién nacido no es un regalo: es tu nevera.");
    }
    return LEAF("Procesos largos son normales en un Sprite que duerme.");
  }

  if (prey.category === "disk") {
    if (/disco al (\d+(\.\d+)?)%/.test(prey.title)) {
      const pct = Number(prey.title.match(/disco al (\d+(\.\d+)?)%/)![1]);
      if (pct >= 92) return GPU("Limpiar /tmp, logs y checkpoints viejos; luego reiniciar.", "Casi sin casa. Esto es un regalo de verdad.", 0.95);
      if (pct >= 80) return sightings >= 2 ? TOFU("Mover datos fríos o borrar checkpoints.", "Crece cada noche. Va a podrirse.") : LEAF("Aún hay sitio.");
    }
    return LEAF("No hay prisa.");
  }

  if (prey.category === "service") {
    if (/detenido/.test(prey.title)) {
      return livesRemaining >= 1
        ? GPU("Reiniciar el servicio con `sprite-env services restart <nombre>`.", "Un servicio caído es un ratón que se escapó.")
        : TOFU("Decidir si ese servicio debe existir.", "¿Apagado o muerto? No me quedan vidas para averiguarlo.", 0.6);
    }
    return LEAF("Servicio vivo.");
  }

  if (prey.category === "log") {
    if (/gigante/.test(prey.title)) {
      return sightings >= 2 ? TOFU("truncar el log y revisar si hay un error en bucle.", "Cada noche más gordo: esto va a llenarte la caja.") : LEAF("Solo estaba gordo, no podrido.");
    }
    if (/errores frescos/.test(prey.title)) {
      // 3 errores son ruido; muchos, un regalo.
      const matches = prey.evidence.match(/\b(error|fatal|panic|traceback|exception)\b/gi);
      const count = matches ? matches.length : 0;
      if (count >= 8) return GPU("Buscar el stack en el log y corregir el throw.", `Escuché ${count} gritos en la misma pared. Eso no es un ruido: es un gato atrapado.`, 0.95);
      if (count >= 3) return TOFU("Mirar si el log repite el mismo error: puede ser un bucle de reintentos.", "Repite el mismo grito. Esto se pudre.");
    }
    return LEAF("Un log normal es un log aburrido. Perfecto.");
  }

  if (prey.category === "arena") {
    return GPU("Vaciar /tmp (`find /tmp -type f -mtime +1 -delete`).", "Caja de arena llena. Es lo más asqueroso y lo más valioso: te lo traigo con todo el asco.");
  }

  if (prey.category === "certificate") {
    if (/vence/.test(prey.title)) return TOFU("Renovar el certificado ya.", "La leche agria: aún sirve, pero no.");
  }

  return null;
}

/**
 * Elige el regalo final mezclando heurística, memoria de rechazos y vidas.
 * Es una función pura: la usan tanto el motor real como las pruebas.
 */
export function chooseGift(input: DietInput, heuristic: DietVerdict | null): DietVerdict {
  const base = heuristic ?? judgeHeuristic(input) ?? LEAF("Nada que ver aquí.");
  const rejected = input.rejectedKinds ?? [];
  // Un gato que te dio tofu tres veces y lo rechazaste pasa a la hoja.
  if (base.kind === "tofu" && rejected.filter((k) => k === "tofu").length >= 2) {
    return { ...base, kind: "leaf", confidence: Math.max(0.4, base.confidence - 0.3) };
  }
  // GPU sin vidas: el gato no puede comprometerse a cuidar nada.
  if (base.kind === "gpu" && input.livesRemaining === 0) {
    return { ...base, kind: "tofu", reason: `${base.reason} Pero no me quedan vidas para cuidarlo.` };
  }
  return base;
}
