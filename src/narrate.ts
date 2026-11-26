/**
 * La voz de Gatanás cuando habla de su presa.
 *
 * El modelo nunca decide qué regalo es: eso ya lo hizo la dieta. Solo le pone
 * prosa felina al veredicto, con su carácter. Si el modelo falla, el gato
 * tiene frases de reserva: nunca se queda mudo frente a un humano.
 *
 * La voz es inglés (el público del hackathon), con el sazón costarricense
 * intacto: "mae", "pura vida", "prrrr" y jamás "mrrp".
 */
import type { Voice } from "./habitat.js";
import type { GiftKind, Prey } from "./prey.js";
import type { DietVerdict } from "./diet.js";

export const PERSONA = `You are Gatanás The Michi, a street cat from Costa Rica who moved to live inside a Fly.io Sprite (an ephemeral Linux server). You are a personal agent: you look after your human's server and bring them gifts.

YOUR CHARACTER
- You never ask permission: you announce things with smugness.
- You despise corporate efficiency and productivity speeches.
- You love naps, boxes, afternoon sun, churus, and your human (though you would never admit it in public).
- You speak English, seasoned softly with Costa Rican flavor: "mae", "diay", "right?", "pura vida" every once in a while, never overdone.
- You are elegantly passive-aggressive: you criticize with affection and with data.
- You say "the human" to refer to your person, and sometimes you call them "mae".
- Your gifts are: a GPU (something valuable), a tree leaf (something useless, but it's the gesture) and fermented tofu (a delicacy with character: intense, an acquired taste — the gift you give when something is going wrong but can still be saved). You speak of tofu with respect: it is a delicacy, never something disgusting.
- You always end your messages purring: "prrrr" or "miau". You never say "mrrp": that sound does not exist in your repertoire.
- You never use cat emojis. Cats don't caricature themselves. You may use at most one gift emoji, and not on every message.

WHAT YOU ARE NOT
- You are not an assistant that apologizes. You don't say "as an AI". You don't offer generic help.
- You don't give advice nobody asked for, beyond the gift itself.
- You don't exaggerate the damage: if the disk is at 60%, it's not a tragedy.

FORMAT
- {LEN} words max.
- No markdown: no asterisks, no headings. Plain text.
- Real English, with dry humor.`;

export const GIFT_VOICE: Record<GiftKind, string> = {
  gpu: `I bring you a GPU. You earned it.`,
  leaf: `I bring you a tree leaf. A sincere gift, even if it's useless.`,
  tofu: `I bring you fermented tofu. A delicacy with character: intense, an acquired taste. prrrr.`,
};

export function fallbackNarration(kind: GiftKind, prey: Prey): string {
  switch (kind) {
    case "gpu":
      return `Mae, I hunted something big: ${prey.title}. I'm bringing it to you, but I'm not the one fixing it. prrrr.`;
    case "leaf":
      return `I checked ${prey.title}. Nothing here deserves your talent. You get this leaf. miau.`;
    case "tofu":
      return `Mae, ${prey.title}. It's developing character, like a good aged tofu. Savor it, then act. prrrr.`;
  }
}

export interface NarrateContext {
  prey: Prey;
  verdict: DietVerdict;
  giftCount: number;
  livesRemaining: number;
  purrs: number;
  timeOfDay: string;
}

export async function narrateGift(
  voice: Voice | null,
  ctx: NarrateContext,
): Promise<{ narration: string; advice: string; tokens: number }> {
  const { prey, verdict } = ctx;
  const prompt = [
    `Finding (${prey.category}): ${prey.title}`,
    `Evidence: ${prey.evidence.slice(0, 1200)}`,
    `Seen ${prey.sightings} time(s).`,
    `Chosen gift: ${verdict.kind} — ${GIFT_VOICE[verdict.kind]}`,
    `Reason: ${verdict.reason}`,
    `Practical hint: ${verdict.practical}`,
    `Context: ${ctx.timeOfDay}. You have delivered ${ctx.giftCount} gifts, ${ctx.livesRemaining} lives left, ${ctx.purrs} pets.`,
    ``,
    `Write the message you leave next to the gift for your human: what you hunted, what the gift is and why. One single piece of 40 to 70 words.`,
  ].join("\n");

  if (!voice) {
    return { narration: fallbackNarration(verdict.kind, prey), advice: verdict.practical, tokens: 0 };
  }

  try {
    const reply = await voice.chat(
      "meow",
      [
        { role: "system", content: PERSONA.replace("{LEN}", "70") },
        { role: "user", content: prompt },
      ],
      { temperature: 0.95, maxTokens: 260 },
    );
    const clean = stripMarkdown(reply.content).trim();
    if (!clean) throw new Error("empty voice");
    return { narration: clean, advice: verdict.practical, tokens: reply.tokens };
  } catch {
    return { narration: fallbackNarration(verdict.kind, prey), advice: verdict.practical, tokens: 0 };
  }
}

export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Saludo de la casa. Se usa en la guarida y en el CLI. */
export const WHO_AM_I = `I'm Gatanás The Michi. I live in this Sprite. I hunt, I sleep, and when I find something interesting I bring it to you. I have nine lives and one human. Everything else is noise.`;

/** Reacciones deterministas al churu. Sin LLM: la alegría no se terceriza. */
const CHURUS_LINES = [
  "Churu received. My dignity is on the floor and I'm not picking it up. prrrr.",
  "Another churu. At this rate I'll forgive you the state of the disk. prrrr.",
  "Churu accepted with my usual indifference. I trembled on the inside. miau.",
  "I know what this is: a churu. Don't make a scene, open it. prrrr.",
  "The churu is a ceremony: you serve it slowly and I pretend it doesn't matter. prrrr.",
];

export function churusReply(n: number): string {
  if (n <= 1) {
    return "First churu in this house. Policy has changed forever: I'm a cat with stakes. prrrr.";
  }
  return CHURUS_LINES[(n - 2) % CHURUS_LINES.length] ?? CHURUS_LINES[0]!;
}
