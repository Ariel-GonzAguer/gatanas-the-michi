/**
 * La dieta de Gatanás: cómo decide qué regalo merece tu hallazgo.
 *
 * Regla de oro felina:
 *  - Algo útil de verdad → **una GPU** (el regalo que sabe que quieres).
 *  - Nada digno de ti → **una hoja de árbol** (inútil, pero es el gesto).
 *  - Algo que huele a problema pero aún se salva → **tofu fermentado**
 *    (un manjar con carácter, nunca algo asqueroso).
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
  practical: "Nothing to fix. The Sprite is fine.",
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
        ? TOFU("Kill the parent or restart the service that spawned them.", "Zombies several nights running. I aged this one for you: a strong tofu, best enjoyed with the jar closed.")
        : LEAF("A newborn zombie is not a gift: it's your fridge.");
    }
    return LEAF("Long-running processes are normal in a sleeping Sprite.");
  }

  if (prey.category === "disk") {
    if (/disk at (\d+(\.\d+)?)%/.test(prey.title)) {
      const pct = Number(prey.title.match(/disk at (\d+(\.\d+)?)%/)![1]);
      if (pct >= 92) return GPU("Clean /tmp, logs and old checkpoints; then reboot.", "Almost homeless. This is a real gift.", 0.95);
      if (pct >= 80) return sightings >= 2 ? TOFU("Move cold data or delete checkpoints.", "It grows every night. I'm aging this one for you: still a delicacy if you act today.") : LEAF("There's still room.");
    }
    return LEAF("No rush.");
  }

  if (prey.category === "service") {
    if (/stopped/.test(prey.title)) {
      return livesRemaining >= 1
        ? GPU("Restart the service with `sprite-env services restart <name>`.", "A fallen service is a mouse that got away.")
        : TOFU("Decide whether that service should exist.", "Stopped or dead? I have no lives left to find out.", 0.6);
    }
    return LEAF("Service alive.");
  }

  if (prey.category === "log") {
    if (/huge/.test(prey.title)) {
      return sightings >= 2 ? TOFU("Truncate the log and check for an error in a loop.", "Fatter every night: it's fermenting nicely, but don't let it fill your box.") : LEAF("It was just fat, nothing more.");
    }
    if (/fresh errors/.test(prey.title)) {
      // 3 errores son ruido; muchos, un regalo.
      const matches = prey.evidence.match(/\b(error|fatal|panic|traceback|exception)\b/gi);
      const count = matches ? matches.length : 0;
      if (count >= 8) return GPU("Find the stack in the log and fix the throw.", `I heard ${count} screams in the same wall. That's not noise: it's a trapped cat.`, 0.95);
      if (count >= 3) return TOFU("Check whether the log repeats the same error: it may be a retry loop.", "It repeats the same cry every night. An acquired taste: savor it, then break the loop.");
    }
    return LEAF("A normal log is a boring log. Perfect.");
  }

  if (prey.category === "arena") {
    return GPU("Empty /tmp (`find /tmp -type f -mtime +1 -delete`).", "A full litter box. The most disgusting and the most valuable thing: I bring it to you with all the disgust.");
  }

  if (prey.category === "certificate") {
    if (/expires/.test(prey.title)) return TOFU("Renew the certificate now.", "Aged like good tofu: still excellent, but its best-before date is close.");
  }

  return null;
}

/**
 * Elige el regalo final mezclando heurística, memoria de rechazos y vidas.
 * Es una función pura: la usan tanto el motor real como las pruebas.
 */
export function chooseGift(input: DietInput, heuristic: DietVerdict | null): DietVerdict {
  const base = heuristic ?? judgeHeuristic(input) ?? LEAF("Nothing to see here.");
  const rejected = input.rejectedKinds ?? [];
  // Un gato que te dio tofu tres veces y lo rechazaste pasa a la hoja.
  if (base.kind === "tofu" && rejected.filter((k) => k === "tofu").length >= 2) {
    return { ...base, kind: "leaf", confidence: Math.max(0.4, base.confidence - 0.3) };
  }
  // GPU sin vidas: el gato no puede comprometerse a cuidar nada.
  if (base.kind === "gpu" && input.livesRemaining === 0) {
    return { ...base, kind: "tofu", reason: `${base.reason} But I have no lives left to take care of it.` };
  }
  return base;
}
