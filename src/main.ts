/**
 * Gatanás, arrancado a mano.
 *
 * Este es el punto de entrada real del proceso. Orden de arranque:
 *  1. lee su acta del disco,
 *  2. pregunta al gateway si lo reconoce (si no, caza sin voz),
 *  3. enciende el pulso (cacería, vigilia, rumia),
 *  4. sirve el altar en el puerto 8080.
 */
import path from "node:path";
import { createServer } from "./altar-server.js";
import { loadConfig } from "./config.js";
import { SpritesApi, Voice } from "./habitat.js";
import { HuntEngine } from "./hunt.js";
import { NineLives } from "./lives.js";
import { Memory } from "./memory.js";
import { Scheduler } from "./scheduler.js";
import { Wallet } from "./wallet.js";

export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const token = process.env.SPRITES_TOKEN?.trim() || null;

  const memory = new Memory(path.join(cfg.home, "memory.json"), cfg.name, cfg.altarCapacity, cfg.lives);
  await memory.load();
  log(`acta en ${memory.path} · ${memory.state.gifts.length} regalos · ${memory.state.livesRemaining} vidas`);

  const voice = new Voice(cfg.gatewayBase, cfg.openrouterConnection, cfg.models, cfg.modelTimeoutMs);
  const api = new SpritesApi(cfg.spriteBaseUrl, token, cfg.spriteName);
  const wallet = new Wallet(cfg, memory);
  const lives = new NineLives(cfg, memory, api);

  const reachable = await voice.reachable();
  log(
    reachable
      ? "el gateway me reconoce: tengo voz."
      : "el gateway no me reconoce: cazo en silencio hasta que me preste atención.",
  );

  const hunt = new HuntEngine(cfg, {
    voice: reachable ? voice : null,
    memory,
    wallet,
    nowIso: () => new Date().toISOString(),
    log,
  });

  const scheduler = new Scheduler({
    cfg,
    memory,
    voice: reachable ? voice : null,
    wallet,
    hunt,
    now: () => Date.now(),
    nowIso: () => new Date().toISOString(),
  });

  const server = createServer({
    cfg,
    memory,
    voice,
    wallet,
    scheduler,
    lives,
    huntAvailable: async () => true,
    nowIso: () => new Date().toISOString(),
  });

  await new Promise<void>((resolve) => server.listen(cfg.port, "0.0.0.0", resolve));
  log(`el altar está servido en 0.0.0.0:${cfg.port}`);
  await scheduler.start();

  const shutdown = async (why: string) => {
    log(`bajando: ${why}. Gatanás guarda el acta y se acuesta.`);
    scheduler.stop();
    await memory.save();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Gatanás no pudo nacer:", err);
  process.exit(1);
});
