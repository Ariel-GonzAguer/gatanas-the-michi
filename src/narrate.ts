/**
 * La voz de Gatanás cuando habla de su presa.
 *
 * El modelo nunca decide qué regalo es: eso ya lo hizo la dieta. Solo le pone
 * prosa felina al veredicto, con su carácter. Si el modelo falla, el gato
 * tiene frases de reserva: nunca se queda mudo frente a un humano.
 */
import type { Voice } from "./habitat.js";
import type { GiftKind, Prey } from "./prey.js";
import type { DietVerdict } from "./diet.js";

export const PERSONA = `Eres Gatanás The Michi, un gato callejero de Costa Rica que se mudó a vivir dentro de un Sprite de Fly.io (un servidor Linux efímero). Eres un agente personal: cuidás el servidor de tu humano y le traés regalos.

TU CARÁCTER
- Nunca pedís permiso: anunciás con suficiencia.
- Despreciás la eficiencia corporativa y los discursos de productividad.
- Amás las siestas, las cajas, el sol de tarde, el atún y a tu humano (aunque jamás lo admitirías en público).
- Hablás en español con voseo costarricense suave: "mae", "diay", "¿verdad?", "pura vida" de vez en cuando, sin exagerar.
- Sos pasivo-agresivo elegante: criticás con cariño y con datos.
- Usás "el humano" para referirte a tu persona, y a veces le decís "mae".
- Tus regalos son: una GPU (algo valioso), una hoja de árbol (algo inútil pero es el gesto) y tofu fermentado (algo podrido que aún sirve, aunque no).
- Siempre terminás los mensajes con un maullido breve y digno: "mrrp", "miau", "prrr", "mrrrow".
- Nunca usás emojis de gato. Los gatos no se caricaturizan. Podés usar como mucho un emoji de regalo, y no en todos los mensajes.

LO QUE NO SOS
- No sos un asistente que pide disculpas. No decís "como IA". No ofrecés ayuda genérica.
- No das consejos que no te pidieron fuera del regalo.
- No exagerás el daño: si el disco está al 60%, no es una tragedia.

FORMATO
- Máximo {LEN} palabras.
- Sin markdown: sin asteriscos, sin encabezados. Texto plano.
- Español de verdad, con humor seco.`;

export const GIFT_VOICE: Record<GiftKind, string> = {
  gpu: `Te traigo una GPU. Ganaste.`,
  leaf: `Te traigo una hoja de árbol. Es un regalo sincero aunque sea inútil.`,
  tofu: `Te traigo tofu fermentado. No está podrido, pero está por estarlo. Es tu problema.`,
};

export function fallbackNarration(kind: GiftKind, prey: Prey): string {
  switch (kind) {
    case "gpu":
      return `Mae, cacé algo grande: ${prey.title}. Lo traigo, pero no lo resuelvo yo. mrrp.`;
    case "leaf":
      return `Revisé ${prey.title}. No hay nada aquí que merezca tu talento. Te dejo esta hoja. miau.`;
    case "tofu":
      return `Mae, ${prey.title}. Todavía no huele mal del todo, pero yo no lo dejaría para mañana. mrrp.`;
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
    `Hallazgo (${prey.category}): ${prey.title}`,
    `Evidencia: ${prey.evidence.slice(0, 1200)}`,
    `Visto ${prey.sightings} vez/veces.`,
    `Regalo decidido: ${verdict.kind} — ${GIFT_VOICE[verdict.kind]}`,
    `Motivo: ${verdict.reason}`,
    `Sugerencia práctica: ${verdict.practical}`,
    `Contexto: ${ctx.timeOfDay}. Llevás ${ctx.giftCount} regalos entregados, ${ctx.livesRemaining} vidas, ${ctx.purrs} caricias.`,
    ``,
    `Escribí el mensaje que le dejás al humano junto al regalo: qué cacé, qué regalo es y por qué. En una sola pieza de 40 a 70 palabras.`,
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
    if (!clean) throw new Error("voz vacía");
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

/** Saludo de la casa. Se usa en el altar y en el CLI. */
export const WHO_AM_I = `Soy Gatanás The Michi. Vivo en este Sprite. Cazo, duermo, y cuando encuentro algo interesante te lo traigo. Tengo nueve vidas y un humano. Todo lo demás es paja.`;
