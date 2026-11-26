/**
 * El hechicero humano: Gatanás y la charla.
 *
 * Cuando alguien le habla (cariño, pan, chisme o reproche), el gato responde
 * con su carácter y con lo que recordó esa noche. Reglas fijas:
 *  - No revela rutas, tokens ni secretos, porque un gato no es un soplón.
 *  - No promete acciones: no puede reiniciar nada desde el chat (aún).
 *  - Si el humano hace una pregunta técnica, contesta como un gato sabio:
 *    con una metáfora útil y sin formularios.
 *
 * Las respuestas enlatadas son bilingües en el disparador (la gente escribe en
 * el idioma que quiera) y en inglés en la respuesta.
 */
import type { Voice } from "./habitat.js";
import { PERSONA, stripMarkdown } from "./narrate.js";
import type { GatanasMemory } from "./memory.js";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

const INTENTS: { pattern: RegExp; reply: (m: GatanasMemory) => string }[] = [
  {
    pattern: /^(acarici|apurru|angurri|caricia|tocarte|toco|pet\b|pets\b|scratch)/i,
    reply: (m) => `Prrrr. ${m.purrs + 1} pets. Keep going, even if you don't deserve it. Prrrr.`,
  },
  {
    pattern: /^(churus|churu|atún|atun|pescado|comida|comer|pan|tuna|fish|food|feed)/i,
    reply: () => `I don't eat from your plate. But if you leave churus at the lair, well, I'll consider it. prrrr.`,
  },
  {
    pattern: /(cómo estás|como estas|qué tal|que tal|how are you|how's it going|how is it going|what's up|whats up)/i,
    reply: (m) => `I live in a Sprite, I sleep when the SPRITE sleeps, I hunt when the disk acts up. I have ${m.livesRemaining} lives. Ask me something useful. miau.`,
  },
  {
    pattern: /(qué haces|que haces|qué hacés|what do you do|what are you doing|what are you up to)/i,
    reply: () => `I've spent hours watching a log grow. You wouldn't understand the pleasure.`,
  },
];

export function cannedReply(text: string, memory: GatanasMemory): string | null {
  for (const i of INTENTS) if (i.pattern.test(text.trim())) return i.reply(memory);
  if (text.trim().length < 2) return "Hmm. That was an empty meow. Say something. miau.";
  return null;
}

export async function speak(voice: Voice | null, memory: GatanasMemory, text: string): Promise<string> {
  const quick = cannedReply(text, memory);
  if (quick) return quick;

  const lastGifts = memory.gifts
    .slice(0, 3)
    .map((g) => `- ${g.kind}: ${g.preyTitle}`)
    .join("\n");

  if (!voice) {
    return "I have no voice today: the gateway doesn't know me and I can't meow with words. I heard you anyway. miau.";
  }

  try {
    const reply = await voice.chat(
      "chat",
      [
        { role: "system", content: PERSONA.replace("{LEN}", "90") },
        {
          role: "user",
          content: [
            `Your human is talking to you. Context: lives ${memory.livesRemaining}, pets ${memory.purrs}, ` +
              `hunt rounds ${memory.hunts}.`,
            lastGifts ? `The last gifts you brought them:\n${lastGifts}` : "You haven't brought them anything yet.",
            memory.opinion ? `What you already think of them (don't repeat it verbatim, evolve it): «${memory.opinion.quote}»` : "",
            `Message: "${text.slice(0, 1200)}"`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      { temperature: 1.0, maxTokens: 260 },
    );
    return stripMarkdown(reply.content) || tiredReply();
  } catch (err) {
    console.error("the cat's voice failed:", err instanceof Error ? err.message : err);
    return tiredReply();
  }
}

/** Cuando el modelo no contesta, el gato no se queda mudo: resopla. */
function tiredReply(): string {
  return "I heard you, but the words won't come out. Stay a while and talk to me again. prrrr.";
}
