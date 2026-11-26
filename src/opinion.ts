/**
 * La opinión de Gatanás sobre ti.
 *
 * Cada noche, si el Sprite duerme con presupuesto de tokens disponible, el
 * gato rumia: mira los regalos de la semana, las caricias, las vidas gastadas,
 * y deja una confesión guardada. Es lo primero que se ve en el altar.
 *
 * Si nunca ha visto nada, no escribe nada. Un gato que no te conoce no opina
 * de vos: te ignora, que es peor.
 */
import type { Voice } from "./habitat.js";
import { PERSONA, stripMarkdown } from "./narrate.js";
import type { Opinion } from "./opinion-types.js";
import type { GatanasMemory } from "./memory.js";

export const CONFESSION_PREFIX = "Mi opinión sobre mi humano:";

export interface RuminationInput {
  memory: GatanasMemory;
  /** Día de la semana y horas en el Sprite, para el tono. */
  nowIso: string;
  /** Cuántos días lleva el gato sin recibir caricias. */
  purrDrought: number;
  budgetLeft: number;
}

export function shouldRuminate(input: RuminationInput): boolean {
  if (input.memory.gifts.length === 0) return false;
  if (input.budgetLeft <= 0) return false;
  const last = input.memory.opinion?.ts;
  if (!last) return true;
  const lastDay = last.slice(0, 10);
  return lastDay !== input.nowIso.slice(0, 10);
}

export async function ruminate(voice: Voice | null, input: RuminationInput): Promise<Opinion | null> {
  const gifts = input.memory.gifts.slice(0, 12);
  const kinds = gifts.reduce<Record<string, number>>((acc, g) => {
    acc[g.kind] = (acc[g.kind] ?? 0) + 1;
    return acc;
  }, {});

  const summary = gifts
    .map((g) => `- ${g.kind}: ${g.narration.slice(0, 140)}`)
    .join("\n");

  const fallback: Opinion = {
    quote: fallbackOpinion(input),
    ts: input.nowIso,
  };

  if (!voice) return fallback;

  try {
    const reply = await voice.chat(
      "opinion" as never,
      [
        { role: "system", content: PERSONA.replace("{LEN}", "90") },
        {
          role: "user",
          content: [
            "Momentos de rumia. Mira tu propia cacería y formá una opinión sobre tu humano.",
            `Regalos que trajiste: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ") || "ninguno"}.`,
            `Vidas restantes: ${input.memory.livesRemaining}. Caricias: ${input.memory.purrs}. Hechicero humano lleva ${input.purrDrought} días sin tocarte.`,
            `Títulos que le diste: ${input.memory.humanTitles.slice(0, 7).join(", ") || "ninguno"}.`,
            `Escribe exactamente al formato: "${CONFESSION_PREFIX} [una sola oración compuesta de 20 a 45 palabras, tu opinión sincera y pasivo-agresiva sobre este humano en particular]".`,
            `Si su humano es un desastre, decilo con elegancia. Si es un buen humano, admitilo a regañadientes.`,
            `Datos de cacería:\n${summary || "nada"}`,
          ].join("\n"),
        },
      ],
      { temperature: 1.0, maxTokens: 200 },
    );
    const line = stripMarkdown(reply.content.trim());
    const quote = line.startsWith(CONFESSION_PREFIX)
      ? line
      : `${CONFESSION_PREFIX} ${line}`;
    if (quote.length < CONFESSION_PREFIX.length + 10) throw new Error("rumia vacía");
    return { quote, ts: input.nowIso, tokens: reply.tokens };
  } catch {
    return fallback;
  }
}

/** Versión determinista: la usa el altar cuando el gato está sin voz. */
export function fallbackOpinion(input: RuminationInput): string {
  const m = input.memory;
  const gpus = m.gifts.filter((g) => g.kind === "gpu").length;
  const tofu = m.gifts.filter((g) => g.kind === "tofu").length;
  if (m.purrs === 0) return `${CONFESSION_PREFIX} Este humano recibe mis regalos y no acaricia. Así no se cría a un gato.`;
  if (tofu > gpus) return `${CONFESSION_PREFIX} Le traje ${tofu} tofus fermentados. Sigue igual. Un humano que no se pudre con su propio hogar es un humano raro.`;
  if (gpus > 0) return `${CONFESSION_PREFIX} Le traje ${gpus} cosas valiosas. Lo hace bien, aunque no me dé atún por eso.`;
  return `${CONFESSION_PREFIX} Vive en una casa demasiado limpia. Me aburre, pero lo adopto.`;
}

/** Título honorífico basado en cómo trata al gato. */
export function titleFor(m: GatanasMemory, purrDrought: number): string {
  if (m.purrs === 0) return "el que nunca acaricia";
  const gpus = m.gifts.filter((g) => g.kind === "gpu").length;
  const tofu = m.gifts.filter((g) => g.kind === "tofu").length;
  if (purrDrought > 3) return "el distraído pero querible";
  if (tofu >= 3 && gpus <= 1) return "el que arregla todo mañana";
  if (gpus >= 3) return "el que escucha al gato";
  if (m.purrs >= 20) return "el buen humano";
  return "el que intenta";
}

export const TREAT_PUZZLE = (purrDrought: number): string =>
  purrDrought >= 3
    ? "Gatanás te mira desde el altar. No desvía la mirada. Significa: llevas días sin acariciar."
    : "Gatanás te deja pasar. Es un honor menor, pero es un honor.";
