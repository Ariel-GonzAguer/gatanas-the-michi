/**
 * La opinión de Gatanás sobre ti.
 *
 * Cada noche, si el Sprite duerme con presupuesto de tokens disponible, el
 * gato rumia: mira los regalos de la semana, las caricias, las vidas gastadas,
 * y deja una confesión guardada. Es lo primero que se ve en la guarida.
 *
 * Si nunca ha visto nada, no escribe nada. Un gato que no te conoce no opina
 * de vos: te ignora, que es peor.
 */
import type { Voice } from "./habitat.js";
import { PERSONA, stripMarkdown } from "./narrate.js";
import type { Opinion } from "./opinion-types.js";
import type { GatanasMemory } from "./memory.js";

export const CONFESSION_PREFIX = "My opinion of my human:";

/** The confession without its prefix, for places that already announce it (the lair's <h2>). */
export function opinionBody(quote: string): string {
  return quote.startsWith(CONFESSION_PREFIX)
    ? quote.slice(CONFESSION_PREFIX.length).trim()
    : quote;
}

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
      "opinion",
      [
        { role: "system", content: PERSONA.replace("{LEN}", "90") },
        {
          role: "user",
          content: [
            "Rumination moment. Look at your own hunt and form an opinion of your human.",
            `Gifts you brought: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(", ") || "none"}.`,
            `Lives left: ${input.memory.livesRemaining}. Pets: ${input.memory.purrs}. Your human has gone ${input.purrDrought} days without touching you.`,
            `Titles you gave them: ${input.memory.humanTitles.slice(0, 7).join(", ") || "none"}.`,
            `Write exactly this format: "${CONFESSION_PREFIX} [a single compound sentence of 20 to 45 words, your sincere and passive-aggressive opinion of this particular human]".`,
            `If your human is a mess, say it with elegance. If they're a good human, admit it grudgingly.`,
            `Hunt data:\n${summary || "nothing"}`,
          ].join("\n"),
        },
      ],
      { temperature: 1.0, maxTokens: 200 },
    );
    const line = stripMarkdown(reply.content.trim());
    const quote = line.startsWith(CONFESSION_PREFIX)
      ? line
      : `${CONFESSION_PREFIX} ${line}`;
    if (quote.length < CONFESSION_PREFIX.length + 10) throw new Error("empty rumination");
    return { quote, ts: input.nowIso, tokens: reply.tokens, cost: reply.cost };
  } catch {
    return fallback;
  }
}

/** Versión determinista: la usa la guarida cuando el gato está sin voz. */
export function fallbackOpinion(input: RuminationInput): string {
  const m = input.memory;
  const gpus = m.gifts.filter((g) => g.kind === "gpu").length;
  const tofu = m.gifts.filter((g) => g.kind === "tofu").length;
  if (m.purrs === 0) return `${CONFESSION_PREFIX} This human receives my gifts and never pets me. That's no way to raise a cat.`;
  if (tofu > gpus) {
    return `${CONFESSION_PREFIX} I brought them ${tofu === 1 ? "1 fermented tofu" : `${tofu} fermented tofus`}. They stay the same. A human whose home never changes is a strange human.`;
  }
  if (gpus > 0) {
    const valioso = gpus === 1 ? "1 valuable thing" : `${gpus} valuable things`;
    return `${CONFESSION_PREFIX} I brought them ${valioso}. They do fine, even if they don't give me churus for it.`;
  }
  return `${CONFESSION_PREFIX} They live in a house that's too clean. It bores me, but I adopt them anyway.`;
}
