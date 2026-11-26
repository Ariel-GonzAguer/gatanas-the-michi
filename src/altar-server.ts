/**
 * El altar y la charla: el servidor HTTP del gato.
 *
 * Es un `http` de la librería estándar en el puerto que el proxy del Sprite
 * enruta a su URL HTTPS. Rutas:
 *
 *   GET  /                 el altar (página completa)
 *   GET  /api/status       estado del gato en JSON
 *   GET  /api/gifts        los regalos del altar
 *   GET  /api/lives        vidas y checkpoints
 *   POST /api/chat         hablarle al gato { message }
 *   POST /api/purr         acariciarlo
 *   POST /api/hunt         mandarlo a cazar ahora
 *   POST /api/revive       tirarse de la mesa y revivir (alias: /api/nahualada)
 *
 * Límites de golpes para que un bot no le arruine el día al gato.
 */
import { createServer as createHttpServer } from "node:http";
import type { ServerResponse, IncomingMessage, Server } from "node:http";
import { altarHtml, type AltarSnapshot } from "./altar.js";
import { speak } from "./chat.js";
import type { GatanasConfig } from "./config.js";
import type { NineLives } from "./lives.js";
import type { Memory } from "./memory.js";
import type { Scheduler } from "./scheduler.js";
import type { Voice } from "./habitat.js";
import type { Wallet } from "./wallet.js";

export interface ServerDeps {
  cfg: GatanasConfig;
  memory: Memory;
  voice: Voice;
  wallet: Wallet;
  scheduler: Scheduler;
  lives: NineLives;
  huntAvailable: () => Promise<boolean>;
  nowIso: () => string;
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Limitador: n golpes por minuto. Un gato aguanta poco tráfico. */
function limiter(maxPerMinute: number): () => boolean {
  const hits: number[] = [];
  return () => {
    const now = Date.now();
    while (hits.length && now - hits[0]! > 60_000) hits.shift();
    if (hits.length >= maxPerMinute) return false;
    hits.push(now);
    return true;
  };
}

export function createServer(deps: ServerDeps): Server {
  const chatLimit = limiter(20);
  const purrLimit = limiter(30);
  const huntLimit = limiter(3);
  const lifeLimit = limiter(3);

  return createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://gatanas.local");
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/altar")) {
        const m = deps.memory.state;
        const snapshot: AltarSnapshot = {
          name: deps.cfg.name,
          memory: m,
          alive: deps.scheduler.isAlive,
          awake: deps.scheduler.isAlive && !deps.scheduler.inNahualada,
          lastWatchAt: m.lastWatchAt,
          voiceOk: true,
          lives: m.livesRemaining,
          purrDrought: deps.memory.purrDrought(deps.nowIso()),
          now: deps.nowIso(),
        };
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          ...SECURITY_HEADERS,
        });
        res.end(altarHtml(snapshot));
        return;
      }

      if (req.method === "GET" && url.pathname === "/robots.txt") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("User-agent: *\nDisallow: /api/\n");
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        const m = deps.memory.state;
        json(res, 200, {
          name: deps.cfg.name,
          alive: deps.scheduler.isAlive,
          awake: !deps.scheduler.inNahualada,
          lives: m.livesRemaining,
          purrs: m.purrs,
          hunts: m.hunts,
          gifts: m.gifts.length,
          lastHuntAt: m.lastHuntAt,
          lastWatchAt: m.lastWatchAt,
          wallet: deps.wallet.state(),
          opinion: m.opinion?.quote ?? null,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/gifts") {
        json(res, 200, { gifts: deps.memory.state.gifts.slice(0, 50) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/lives") {
        json(res, 200, deps.lives.state);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!chatLimit()) {
          json(res, 429, { reply: "Dejá de escribirme. Soy un gato, no un chatbot. miau." });
          return;
        }
        const body = await readBody(req);
        let message = "";
        try {
          message = String((JSON.parse(body) as { message?: unknown }).message ?? "");
        } catch {
          json(res, 400, { reply: "Eso no fue un maullido válido." });
          return;
        }
        if (deps.scheduler.inNahualada) {
          json(res, 200, { reply: "Estoy reviviendo. No me hablés ahora. mrrp." });
          return;
        }
        const reply = await speak(deps.voice, deps.memory.state, message.slice(0, 1200));
        json(res, 200, { reply });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/purr") {
        if (!purrLimit()) {
          json(res, 429, {
            reply: "Prrrr. Suficiente por hoy. Ya te quejás de que no te trabajo.",
            purrs: deps.memory.state.purrs,
          });
          return;
        }
        const n = deps.memory.purr();
        await deps.memory.save();
        json(res, 200, {
          purrs: n,
          reply:
            n === 1
              ? "Prrrr. Es la primera. No te acostumbres."
              : `Prrrr. ${n} caricias. Sigo esperando el atún.`,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/hunt") {
        if (!huntLimit()) {
          json(res, 429, { reply: "El gato está cansado de cazar. Probá en un minuto." });
          return;
        }
        if (!(await deps.huntAvailable())) {
          json(res, 503, { reply: "No tengo llave para cazar en mi propia casa ahora. miau." });
          return;
        }
        const out = await deps.scheduler.huntNow("request");
        json(res, 200, {
          reply:
            out === null
              ? "Estoy reviviendo. No cazo ahora."
              : out.ran
                ? `Traje ${out.gifts.length} regalo(s) de ${out.found} hallazgo(s).`
                : (out.reason ?? "No salió la cacería."),
          outcome: out,
        });
        return;
      }

      if (
        req.method === "POST" &&
        (url.pathname === "/api/revive" || url.pathname === "/api/nahualada")
      ) {
        if (!lifeLimit()) {
          json(res, 429, { reply: "Un gato no muere tantas veces por minuto." });
          return;
        }
        const body = await readBody(req);
        let reason = "porque me diste la gana";
        try {
          reason = (JSON.parse(body || "{}") as { reason?: string }).reason ?? reason;
        } catch {
          /* el motivo es opcional */
        }
        const reply = await deps.scheduler.performNahualada(reason.slice(0, 200));
        json(res, 200, { reply, lives: deps.lives.state });
        return;
      }

      json(res, 404, { reply: "Aquí no hay nada. Ni una caja. miau." });
    } catch (err) {
      console.error("error en el altar:", err);
      json(res, 500, { reply: "Me atraganté con algo. Volvé a intentar. mrrp." });
    }
  });
}
