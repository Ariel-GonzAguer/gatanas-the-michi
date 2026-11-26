/**
 * El altar y el servidor, probados contra un acta real en un directorio
 * temporal y un puerto efímero.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer } from "../src/altar-server.js";
import { altarHtml } from "../src/altar.js";
import { loadConfig } from "../src/config.js";
import { NineLives } from "../src/lives.js";
import { Memory } from "../src/memory.js";
import type { Scheduler } from "../src/scheduler.js";
import { Wallet } from "../src/wallet.js";

async function boot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-srv-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  memory.addGift({
    id: "g1",
    kind: "gpu",
    preyKey: "k",
    preyTitle: "disk at 96.0%",
    narration: "Mae, brought you a GPU. prrrr.",
    advice: "Clean /tmp.",
    huntNotes: "",
    tokens: 0,
    host: "this Sprite",
    at: new Date().toISOString(),
  });
  await memory.save();
  const wallet = new Wallet(cfg, memory);
  const lives = new NineLives(cfg, memory, null);
  const fakeScheduler = {
    isAlive: () => true,
    inNahualada: false,
    huntNow: async () => ({ ran: true, gifts: [], found: 0, tokens: 0, usd: 0, patrols: [] }),
    performNahualada: async () => "I threw myself",
  } as unknown as Scheduler;
  const server = createServer({
    cfg,
    memory,
    voice: null as never,
    wallet,
    scheduler: fakeScheduler,
    lives,
    huntAvailable: async () => true,
    nowIso: () => new Date().toISOString(),
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return { base: `http://127.0.0.1:${port}`, server, memory };
}

test("the lair is served at / and shows the gift", async () => {
  const { base, server } = await boot();
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /Gatanás The Michi/);
    assert.match(html, /A GPU/);
    assert.match(html, /Clean \/tmp/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
  } finally {
    server.close();
  }
});

test("/api/status and /api/purr answer with JSON", async () => {
  const { base, server, memory } = await boot();
  try {
    const st = (await (await fetch(`${base}/api/status`)).json()) as { gifts: number };
    assert.equal(st.gifts, 1);
    const purr = (await (
      await fetch(`${base}/api/purr`, { method: "POST" })
    ).json()) as { purrs: number; reply: string };
    assert.equal(purr.purrs, 1);
    assert.match(purr.reply, /Prrrr/);
    assert.equal(memory.state.purrs, 1);
  } finally {
    server.close();
  }
});

test("the lair is served at / and /guarida, with chat feedback, churus and how-it-works", async () => {
  const { base, server } = await boot();
  try {
    for (const ruta of ["/", "/guarida"]) {
      const res = await fetch(`${base}${ruta}`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.match(html, /the lair of gifts/);
      assert.match(html, /You're looking at my lair/);
      assert.match(html, /Gatanás is thinking about what to meow back/);
      assert.match(html, /Give churu/);
      assert.match(html, /How does this site work\?/);
      assert.match(html, /aria-live="polite"/);
      assert.ok(!html.includes('class="altar"'));
      assert.ok(!/el altar/i.test(html));
    }
  } finally {
    server.close();
  }
});

test("POST /api/churus increments the counter with different reactions", async () => {
  const { base, server, memory } = await boot();
  try {
    const r1 = (await (await fetch(`${base}/api/churus`, { method: "POST" })).json()) as {
      churus: number;
      reply: string;
    };
    const r2 = (await (await fetch(`${base}/api/churus`, { method: "POST" })).json()) as {
      churus: number;
      reply: string;
    };
    assert.equal(r1.churus, 1);
    assert.equal(r2.churus, 2);
    assert.match(r1.reply, /prrrr|miau/);
    assert.notEqual(r1.reply, r2.reply);
    assert.equal(memory.state.churus, 2);
    const st = (await (await fetch(`${base}/api/status`)).json()) as { churus: number };
    assert.equal(st.churus, 2);
  } finally {
    server.close();
  }
});

test("an unknown route returns a meowed 404", async () => {
  const { base, server } = await boot();
  try {
    const res = await fetch(`${base}/no-existe`);
    assert.equal(res.status, 404);
    assert.match(((await res.json()) as { reply: string }).reply, /miau/);
  } finally {
    server.close();
  }
});

test("the lair HTML-escapes the narration (no injection from the model)", () => {
  const html = altarHtml({
    name: "Gatanás",
    alive: true,
    awake: true,
    lastWatchAt: null,
    voiceOk: true,
    lives: 9,
    purrDrought: 0,
    now: new Date().toISOString(),
    memory: {
      schema: 1,
      createdAt: new Date().toISOString(),
      name: "Gatanás",
      gifts: [
        {
          id: "x",
          kind: "gpu",
          preyKey: "k",
          preyTitle: "<script>alert(1)</script>",
          narration: "<img src=x onerror=alert(1)>",
          advice: "<b>bolita</b>",
          huntNotes: "",
          tokens: 0,
          host: "h",
          at: new Date().toISOString(),
        },
      ],
      livesRemaining: 9,
      lifeEvents: [],
      checkpoints: [],
      purrs: 0,
      lastPurrAt: null,
      churus: 0,
      lastChurusAt: null,
      hunts: 0,
      lastHuntAt: null,
      lastHuntFound: 0,
      watches: 0,
      lastWatchAt: null,
      humanTitles: [],
      opinion: null,
      tokensByDay: {},
      usdByDay: {},
      spentUsd: 0,
      giftedKeys: {},
    },
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.match(html, /&lt;script&gt;/);
});
