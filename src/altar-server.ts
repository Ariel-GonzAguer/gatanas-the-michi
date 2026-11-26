/**
 * El altar y la charla: el servidor HTTP del gato.
 *
 * Es un `http` de la librería estándar en el puerto que el proxy del Sprite
 * enruta a su URL HTTPS. Rutas:
 *
 *   GET  /                 la guarida (página completa; alias: /altar y /guarida)
 *   GET  /api/status       estado del gato en JSON
 *   GET  /api/gifts        los regalos de la guarida
 *   GET  /api/lives        vidas y checkpoints
 *   GET  /api/live         canal SSE: los contadores y la guarida, en vivo
 *   POST /api/chat         hablarle al gato { message }
 *   POST /api/purr         acariciarlo
 *   POST /api/churus       darle un churu
 *   POST /api/hunt         mandarlo a cazar ahora
 *   POST /api/revive       tirarse de la mesa y revivir (alias: /api/nahualada)
 *
 * Límites de golpes para que un bot no le arruine el día al gato.
 */
import { createServer as createHttpServer } from "node:http";
import type { ServerResponse, IncomingMessage, Server } from "node:http";
import { altarHtml, type AltarSnapshot } from "./altar.js";
import { speak } from "./chat.js";
import { churusReply } from "./narrate.js";
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
    let tooBig = false;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        // Se deja de retener el cuerpo pero se sigue drenando la conexión,
        // para poder responder 413 de verdad en vez de cortar el socket.
        tooBig = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (tooBig) {
        const err = new Error("demasiado grande") as Error & { statusCode?: number };
        err.statusCode = 413;
        reject(err);
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
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
  const churusLimit = limiter(30);
  const huntLimit = limiter(3);
  const lifeLimit = limiter(3);

  // --- El canal vivo (SSE) -------------------------------------------------
  // Cada visitante de la guarida se suscribe a GET /api/live. Cuando el acta
  // cambia (mimos, churus, cacerías, vidas, opinión), el servidor empuja el
  // nuevo estado: quien mira la página ve los números saltar en vivo.
  const sseClients = new Set<ServerResponse>();
  type LiveState = {
    lives: number;
    purrs: number;
    churus: number;
    hunts: number;
    gpu: number;
    tofu: number;
    leaf: number;
    top: string;
    op: string;
    note?: string;
  };
  let prev: LiveState | null = null;

  function liveState(): LiveState {
    const m = deps.memory.state;
    const living = m.gifts.filter((g) => !g.rejected);
    return {
      lives: m.livesRemaining,
      purrs: m.purrs,
      churus: m.churus,
      hunts: m.hunts,
      gpu: living.filter((g) => g.kind === "gpu").length,
      tofu: living.filter((g) => g.kind === "tofu").length,
      leaf: living.filter((g) => g.kind === "leaf").length,
      top: living[0]?.id ?? "",
      op: m.opinion?.ts ?? "",
    };
  }

  function broadcastLive(note?: string): void {
    const p = liveState();
    const changed =
      !prev ||
      prev.lives !== p.lives ||
      prev.purrs !== p.purrs ||
      prev.churus !== p.churus ||
      prev.hunts !== p.hunts ||
      prev.gpu !== p.gpu ||
      prev.tofu !== p.tofu ||
      prev.leaf !== p.leaf ||
      prev.top !== p.top ||
      prev.op !== p.op;
    if (!note && !changed) return;
    if (!note && changed && prev) {
      // El cambio lo detectó el sondeo: el gato traduce qué pasó.
      if (p.hunts > prev.hunts) p.note = "a hunt round ended in the dark.";
      else if (p.top && p.top !== prev.top) p.note = "a gift just landed in the lair.";
      else if (p.op && p.op !== prev.op) p.note = "the cat has a new opinion of you.";
    }
    prev = p;
    const frame = `data: ${JSON.stringify(p)}\n\n`;
    for (const client of sseClients) {
      if (!client.writableEnded && !client.destroyed) client.write(frame);
    }
  }

  // Sondeo: caza cambios hechos por el cron o la CLI (no por rutas POST).
  const livePoll = setInterval(() => broadcastLive(), 5_000);
  livePoll.unref();
  // Latido: mantiene abiertas las conexiones tras proxys perezosos.
  const liveBeat = setInterval(() => {
    for (const client of sseClients) {
      if (!client.writableEnded && !client.destroyed) client.write(": ping\n\n");
    }
  }, 25_000);
  liveBeat.unref();

  return createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://gatanas.local");
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/altar" || url.pathname === "/guarida")) {
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
          churus: m.churus,
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

      if (req.method === "GET" && url.pathname === "/api/live") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
          ...SECURITY_HEADERS,
        });
        res.write("retry: 4000\n\n");
        const first = liveState();
        if (!prev) prev = first;
        res.write(`data: ${JSON.stringify(first)}\n\n`);
        sseClients.add(res);
        req.on("close", () => {
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        if (!chatLimit()) {
          json(res, 429, { reply: "Stop writing me. I'm a cat, not a chatbot. miau." });
          return;
        }
        const body = await readBody(req);
        let message = "";
        try {
          const parsed = (JSON.parse(body) as { message?: unknown }).message;
          if (typeof parsed !== "string") throw new Error("message must be a string");
          message = parsed;
        } catch {
          json(res, 400, { reply: "That wasn't a valid meow." });
          return;
        }
        if (deps.scheduler.inNahualada) {
          json(res, 200, { reply: "I'm reviving. Don't talk to me right now. prrrr." });
          return;
        }
        const reply = await speak(deps.voice, deps.memory.state, message.slice(0, 1200));
        json(res, 200, { reply });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/purr") {
        if (!purrLimit()) {
          json(res, 429, {
            reply: "Prrrr. Enough for today. And you still complain I don't work.",
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
              ? "Prrrr. That's the first one. Don't get used to it."
              : `Prrrr. ${n} pets. Still waiting for the churus.`,
        });
        broadcastLive("someone petted the cat. it allowed it.");
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/churus") {
        if (!churusLimit()) {
          json(res, 429, {
            reply: "Enough churus for now. A cat gets dizzy. prrrr.",
            churus: deps.memory.state.churus,
          });
          return;
        }
        const n = deps.memory.giveChurus();
        await deps.memory.save();
        json(res, 200, { churus: n, reply: churusReply(n) });
        broadcastLive("someone just fed the cat a churu.");
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/hunt") {
        if (!huntLimit()) {
          json(res, 429, { reply: "The cat is tired of hunting. Try again in a minute." });
          return;
        }
        if (!(await deps.huntAvailable())) {
          json(res, 503, { reply: "I don't have the key to hunt inside my own house right now. miau." });
          return;
        }
        const out = await deps.scheduler.huntNow("request");
        json(res, 200, {
          reply:
            out === null
              ? "I'm reviving. Not hunting right now."
              : out.ran
                ? `I brought ${out.gifts.length === 1 ? "1 gift" : `${out.gifts.length} gifts`} from ${out.found === 1 ? "1 finding" : `${out.found} findings`}.`
                : (out.reason ?? "The hunt didn't happen."),
          outcome: out,
        });
        if (out && out.ran) broadcastLive("the cat returns from a hunt. check the lair.");
        return;
      }

      if (
        req.method === "POST" &&
        (url.pathname === "/api/revive" || url.pathname === "/api/nahualada")
      ) {
        if (!lifeLimit()) {
          json(res, 429, { reply: "A cat doesn't die that many times per minute." });
          return;
        }
        const body = await readBody(req);
        let reason = "because I felt like it";
        try {
          const parsed = (JSON.parse(body || "{}") as { reason?: unknown }).reason;
          if (typeof parsed === "string" && parsed.trim()) reason = parsed;
        } catch {
          /* el motivo es opcional */
        }
        const reply = await deps.scheduler.performNahualada(reason.slice(0, 200));
        json(res, 200, { reply, lives: deps.lives.state });
        broadcastLive("the cat just used one of its nine lives.");
        return;
      }

      json(res, 404, { reply: "Nothing here. Not even a box. miau." });
    } catch (err) {
      if ((err as Error & { statusCode?: number }).statusCode === 413) {
        json(res, 413, { reply: "That meow is too big. Keep it under 64 KiB. miau." });
        return;
      }
      console.error("error in the lair:", err);
      json(res, 500, { reply: "I choked on something. Try again. prrrr." });
    }
  });
}
