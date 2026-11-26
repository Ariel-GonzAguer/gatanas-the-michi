/**
 * El reparto: cómo le llega el regalo al humano.
 *
 * Un gato te deja la presa en la puerta, no en tu escritorio. Por eso el
 * reparto tiene intentos, en este orden:
 *
 *  1. **Pushover por conector** (si hay uno configurado): el regalo vibra en tu
 *     celular. La credencial vive en el gateway de Sprites, nunca en el gato.
 *  2. **Diálogo del altar** (siempre): el altar se pinta con un globo de
 *     diálogo para cuando vuelvas a entrar. Nadie se queda sin regalo.
 *
 * El reparto nunca hace fallar la cacería: si el push falla, el gato resopla y
 * deja el regalo en el altar igual.
 */
import type { Gift } from "./prey.js";
import { giftEmoji, giftLabel } from "./prey.js";

export interface Deliverer {
  deliver(gift: Gift): Promise<void>;
}

export interface PushoverConnector {
  /** ID del conector en el gateway de Sprites. */
  connectionId: string;
  /** User key del humano (P……). No es secreto vital, pero viaja en el gateway. */
  userKey: string;
}

export interface GatewayPost {
  (path: string, body: unknown): Promise<{ status: number; text: string }>;
}

/** Construye el repartidor de Pushover sobre el gateway. */
export function pushoverDeliverer(
  post: GatewayPost,
  cfg: PushoverConnector,
): Deliverer {
  return {
    async deliver(gift: Gift): Promise<void> {
      const title = `${giftEmoji(gift.kind)} ${giftLabel(gift.kind)} — ${gift.preyTitle}`.slice(0, 250);
      const body = [
        gift.narration,
        "",
        `Disección: ${gift.advice}`,
      ].join("\n").slice(0, 1024);
      const res = await post("/v1/messages", {
        user: cfg.userKey,
        title,
        message: body,
        priority: gift.kind === "gpu" ? 0 : -1,
        sound: gift.kind === "gpu" ? "bugle" : "none",
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Pushover respondió ${res.status}: ${res.text.slice(0, 200)}`);
      }
    },
  };
}

/** El repartidor mudo: el altar es el único destinatario. */
export function altarOnly(): Deliverer {
  return { async deliver(): Promise<void> {} };
}

/** Texto de la notificación, para pruebas y para el altavoz del CLI. */
export function notificationText(gift: Gift): { title: string; message: string } {
  return {
    title: `${giftEmoji(gift.kind)} ${giftLabel(gift.kind)} — ${gift.preyTitle}`.slice(0, 250),
    message: [gift.narration, "", `Disección: ${gift.advice}`].join("\n").slice(0, 1024),
  };
}
