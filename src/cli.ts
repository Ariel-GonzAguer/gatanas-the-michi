/**
 * Gatanás desde la terminal del Sprite.
 *
 *   node dist/cli.js hunt            → una ronda de cacería ahora
 *   node dist/cli.js meow "texto"    → el gato responde
 *   node dist/cli.js altar           → imprime el resumen del altar
 *   node dist/cli.js lives           → vidas y checkpoints
 *   node dist/cli.js revive          → se tira de la mesa y revive (alias: nahualada)
 *
 * El CLI nunca inventa el estado: lee el mismo acta que el servidor.
 */
import path from "node:path";
import { loadConfig } from "./config.js";
import { NineLives } from "./lives.js";
import { Memory } from "./memory.js";
import { SpritesApi, Voice } from "./habitat.js";
import { HuntEngine } from "./hunt.js";
import { speak } from "./chat.js";
import { Wallet } from "./wallet.js";
import { giftEmoji, giftLabel } from "./prey.js";

function out(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  return [line(headers), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const spriteName = process.env.SPRITE_NAME ?? cfg.spriteName;
  const memory = new Memory(path.join(cfg.home, "memory.json"), cfg.name, cfg.altarCapacity, cfg.lives);
  await memory.load();
  const voice = new Voice(cfg.gatewayBase, cfg.openrouterConnection, cfg.models, cfg.modelTimeoutMs);
  const api = new SpritesApi(cfg.spriteBaseUrl, process.env.SPRITES_TOKEN?.trim() || null, spriteName);
  const wallet = new Wallet(cfg, memory);
  const cmd = process.argv[2] ?? "altar";
  const arg = process.argv.slice(3).join(" ");

  switch (cmd) {
    case "hunt": {
      const engine = new HuntEngine(cfg, {
        voice: (await voice.reachable()) ? voice : null,
        memory,
        wallet,
        nowIso: () => new Date().toISOString(),
        log: out,
      });
      const r = await engine.hunt("manual");
      if (!r.ran) {
        out(`sin cacería: ${r.reason ?? "motivo desconocido"}`);
        return;
      }
      for (const g of r.gifts) out(`${giftEmoji(g.kind)} ${giftLabel(g.kind)}\n  ${g.narration}\n  → ${g.advice}`);
      out(`\n${r.found} presas · ${r.gifts.length} regalos · ${r.tokens} tokens · ${wallet.state().spentTodayUsd.toFixed(3)} USD hoy`);
      return;
    }
    case "meow": {
      const reply = await speak(await voice.reachable() ? voice : null, memory.state, arg || "miau");
      out(reply);
      return;
    }
    case "lives": {
      const s = new NineLives(cfg, memory, api).state;
      out(`${s.livesRemaining}/${s.lives} vidas`);
      if (s.lastCheckpoint) out(`último checkpoint: ${s.lastCheckpoint.id} (${s.lastCheckpoint.comment})`);
      for (const e of s.events.slice(-10)) out(`  · ${NineLives.narrative(e)}`);
      return;
    }
    case "revive":
    case "nahualada": {
      const s = new NineLives(cfg, memory, api);
      const ev = await s.loseLife("le tiró una taza a un familiar imaginario");
      out(ev ? NineLives.narrative(ev) : "No me quedan vidas. miau.");
      return;
    }
    case "altar":
    default: {
      const m = memory.state;
      const w = wallet.state();
      out(`${cfg.name} — ${m.livesRemaining}/9 vidas · ${m.purrs} caricias · ${m.hunts} cacerías`);
      out(`${Wallet.mood(w)} (gastado ${w.spentUsd.toFixed(3)} de ${w.capUsd} USD)`);
      out("");
      if (m.gifts.length === 0) {
        out("El altar está vacío. El gato todavía no cazó nada.");
        return;
      }
      out(
        table(
          ["regalo", "qué cacé", "cuándo"],
          m.gifts.slice(0, 20).map((g) => [giftEmoji(g.kind), g.preyTitle, g.at.slice(0, 16).replace("T", " ")]),
        ),
      );
      return;
    }
  }
}

main().catch((err) => {
  console.error("el gato se atragantó:", err);
  process.exit(1);
});
