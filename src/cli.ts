/**
 * Gatanás desde la terminal del Sprite.
 *
 *   node dist/cli.js hunt            → una ronda de cacería ahora
 *   node dist/cli.js meow "texto"    → el gato responde
 *   node dist/cli.js guarida         → imprime el resumen del acta (alias: altar)
 *   node dist/cli.js churus          → darle un churu
 *   node dist/cli.js lives           → vidas y checkpoints
 *   node dist/cli.js revive          → se tira de la mesa y revive (alias: nahualada)
 *
 * El CLI nunca inventa el estado: lee el mismo acta que el servidor. Si el
 * servicio está vivo, las órdenes que escriben el acta (churus) pasan por la
 * API local, para que un solo dueño la escriba.
 */
import path from "node:path";
import { loadConfig } from "./config.js";
import { NineLives } from "./lives.js";
import { Memory } from "./memory.js";
import { SpritesApi, Voice } from "./habitat.js";
import { HuntEngine } from "./hunt.js";
import { speak } from "./chat.js";
import { churusReply } from "./narrate.js";
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
  const voice = new Voice(cfg.gatewayBase, cfg.openrouterConnection, cfg.models, cfg.modelTimeoutMs, cfg.chatModelFallbacks);
  const api = new SpritesApi(cfg.spriteBaseUrl, process.env.SPRITES_TOKEN?.trim() || null, spriteName);
  const wallet = new Wallet(cfg, memory);
  const cmd = process.argv[2] ?? "guarida";
  const arg = process.argv.slice(3).join(" ");

  switch (cmd) {
    case "churus": {
      // Si el servicio está vivo, la orden va por la API local: el acta la
      // escribe un solo dueño y el contador no se pisa.
      try {
        const r = await fetch(`http://127.0.0.1:${cfg.port}/api/churus`, {
          method: "POST",
          signal: AbortSignal.timeout(4000),
        });
        const j = (await r.json()) as { reply?: string; churus?: number };
        out(j.reply ?? `Churu number ${j.churus ?? "?"} delivered. prrrr.`);
        return;
      } catch {
        // Sin servicio: el CLI escribe el acta directamente.
        const n = memory.giveChurus();
        await memory.save();
        out(churusReply(n));
        return;
      }
    }
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
        out(`no hunt: ${r.reason ?? "unknown reason"}`);
        return;
      }
      for (const g of r.gifts) out(`${giftEmoji(g.kind)} ${giftLabel(g.kind)}\n  ${g.narration}\n  → ${g.advice}`);
      out(`\n${r.found} prey · ${r.gifts.length} gifts · ${r.tokens} tokens · ${wallet.state().spentTodayUsd.toFixed(3)} USD today`);
      return;
    }
    case "meow": {
      const reply = await speak(await voice.reachable() ? voice : null, memory.state, arg || "miau");
      out(reply);
      return;
    }
    case "lives": {
      const s = new NineLives(cfg, memory, api).state;
      out(`${s.livesRemaining}/${s.lives} lives`);
      if (s.lastCheckpoint) out(`last checkpoint: ${s.lastCheckpoint.id} (${s.lastCheckpoint.comment})`);
      for (const e of s.events.slice(-10)) out(`  · ${NineLives.narrative(e)}`);
      return;
    }
    case "revive":
    case "nahualada": {
      const s = new NineLives(cfg, memory, api);
      const ev = await s.loseLife("knocked a cup at an imaginary relative");
      out(ev ? NineLives.narrative(ev) : "I have no lives left. miau.");
      return;
    }
    case "altar":
    case "guarida":
    default: {
      const m = memory.state;
      const w = wallet.state();
      out(`${cfg.name} — ${m.livesRemaining}/9 lives · ${m.purrs} pets · ${m.churus} churus · ${m.hunts} hunts`);
      out(`${Wallet.mood(w)} (spent ${w.spentUsd.toFixed(3)} of ${w.capUsd} USD)`);
      out("");
      if (m.gifts.length === 0) {
        out("The lair is empty. The cat hasn't hunted anything yet.");
        return;
      }
      out(
        table(
          ["gift", "what it hunted", "when"],
          m.gifts.slice(0, 20).map((g) => [giftEmoji(g.kind), g.preyTitle, g.at.slice(0, 16).replace("T", " ")]),
        ),
      );
      return;
    }
  }
}

main().catch((err) => {
  console.error("the cat choked:", err instanceof Error ? err.message : err);
  process.exit(1);
});
