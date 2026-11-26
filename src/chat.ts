/**
 * El hechicero humano: Gatanás y la charla.
 *
 * Cuando alguien le habla (cariño, pan, chisme o reproche), el gato responde
 * con su carácter y con lo que recordó esa noche. Reglas fijas:
 *  - No revela rutas, tokens ni secretos, porque un gato no es un soplón.
 *  - No promete acciones: no puede reiniciar nada desde el chat (aún).
 *  - Si el humano hace una pregunta técnica, contesta como un gato sabio:
 *    con una metáfora útil y sin formularios.
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
    pattern: /^(acarici|apurru|angurri|caricia|tocarte|toco)/i,
    reply: (m) => `Prrrr. ${m.purrs + 1} caricias. Sigue así, aunque no lo merezcás. Prrrr.`,
  },
  {
    pattern: /^(atún|atun|pescado|comida|comer|pan)/i,
    reply: () => `Yo no como de tu plato. Pero si dejás un atún en el altar, diay, lo considero. mrrp.`,
  },
  {
    pattern: /(cómo estás|como estas|qué tal|que tal)/i,
    reply: (m) => `Vivo en un Sprite, duermo cuando el SPRITE duerme, cazo cuando el disco se pone raro. Llevo ${m.livesRemaining} vidas. Preguntame algo útil. miau.`,
  },
  {
    pattern: /(qué haces|que haces|qué hacés|que haces)/i,
    reply: () => `Llevo horas mirando un log crecer. Tú no entenderías el placer.`,
  },
];

export function cannedReply(text: string, memory: GatanasMemory): string | null {
  for (const i of INTENTS) if (i.pattern.test(text.trim())) return i.reply(memory);
  if (text.trim().length < 2) return "Mmm. Eso fue un maullido vacío. Decí algo. miau.";
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
    return "Hoy no tengo voz: el gateway no me conoce y no puedo maullar con palabras. Te oí igual. miau.";
  }

  try {
    const reply = await voice.chat(
      "chat",
      [
        { role: "system", content: PERSONA.replace("{LEN}", "90") },
        {
          role: "user",
          content: [
            `Te habla tu humano. Contexto: vidas ${memory.livesRemaining}, caricias ${memory.purrs}, ` +
              `rondas de cacería ${memory.hunts}.`,
            lastGifts ? `Últimos regalos que le trajiste:\n${lastGifts}` : "Todavía no le trajiste nada.",
            memory.opinion ? `Lo que ya opinás de él (no lo repitas literal, evolucioná): «${memory.opinion.quote}»` : "",
            `Mensaje: "${text.slice(0, 1200)}"`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      { temperature: 1.0, maxTokens: 260 },
    );
    return stripMarkdown(reply.content) || tiredReply();
  } catch (err) {
    console.error("la voz del gato falló:", err instanceof Error ? err.message : err);
    return tiredReply();
  }
}

/** Cuando el modelo no contesta, el gato no se queda mudo: resopla. */
function tiredReply(): string {
  return "Te escuché, pero no me salen las palabras. Quedate un rato y volvé a hablarme. mrrp.";
}
