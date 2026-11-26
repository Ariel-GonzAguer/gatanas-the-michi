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
    preyTitle: "disco al 96.0%",
    narration: "Mae, traje una GPU. mrrp.",
    advice: "Limpiar /tmp.",
    huntNotes: "",
    tokens: 0,
    host: "este Sprite",
    at: new Date().toISOString(),
  });
  await memory.save();
  const wallet = new Wallet(cfg, memory);
  const lives = new NineLives(cfg, memory, null);
  const fakeScheduler = {
    isAlive: () => true,
    inNahualada: false,
    huntNow: async () => ({ ran: true, gifts: [], found: 0, tokens: 0, usd: 0, patrols: [] }),
    performNahualada: async () => "me tiré",
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

test("el altar se sirve en / y muestra el regalo", async () => {
  const { base, server } = await boot();
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /Gatanás The Michi/);
    assert.match(html, /Una GPU/);
    assert.match(html, /Limpiar \/tmp/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
  } finally {
    server.close();
  }
});

test("/api/status y /api/purr responden con JSON", async () => {
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

test("una ruta desconocida devuelve 404 maullado", async () => {
  const { base, server } = await boot();
  try {
    const res = await fetch(`${base}/no-existe`);
    assert.equal(res.status, 404);
    assert.match(((await res.json()) as { reply: string }).reply, /miau/);
  } finally {
    server.close();
  }
});

test("el altar escapa HTML de la narración (no hay inyección desde el modelo)", () => {
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
