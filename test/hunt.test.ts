/**
 * La cacería completa, con voz postiza y sin red.
 *
 * Contrato del motor:
 *  - no repite el mismo hallazgo el mismo día,
 *  - no gasta tokens en hojas de árbol,
 *  - respeta el monedero y las vidas,
 *  - deja el regalo en el altar aunque la entrega falle.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import type { Voice, VoiceReply, ChatMessage } from "../src/habitat.js";
import { fixtureCollector, HuntEngine } from "../src/hunt.js";
import { Memory } from "../src/memory.js";
import type { Prey } from "../src/prey.js";
import { Wallet } from "../src/wallet.js";

function frozenNow(iso: string): () => string {
  return () => iso;
}

function preys(): Prey[] {
  const at = "2026-11-26T18:00:00.000Z";
  return [
    {
      key: "disk:this Sprite:disk at 96.0%",
      category: "disk",
      title: "disk at 96.0%",
      evidence: "0.2 GB free",
      host: "this Sprite",
      sightings: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    },
    {
      key: "arena:this Sprite:litter box (/tmp) full",
      category: "arena",
      title: "litter box (/tmp) full",
      evidence: "900 MB",
      host: "this Sprite",
      sightings: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    },
    {
      key: "process:this Sprite:zombie process node",
      category: "process",
      title: "zombie process node",
      evidence: "pid 1234",
      host: "this Sprite",
      sightings: 1,
      firstSeenAt: at,
      lastSeenAt: at,
    },
  ];
}

class FakeVoice {
  calls: ChatMessage[][] = [];
  get base(): string {
    return "fake://openrouter";
  }
  async reachable(): Promise<boolean> {
    return true;
  }
  async hasModel(): Promise<boolean> {
    return true;
  }
  async chat(_task: string, messages: ChatMessage[]): Promise<VoiceReply> {
    this.calls.push(messages);
    return { content: "Mae, brought you something. prrrr.", tokens: 100, cost: 0.0001 };
  }
}

async function engine(opts: { budgetUsd?: number; voice?: FakeVoice | null } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-hunt-"));
  const cfg = loadConfig({
    home: dir,
    lives: 9,
    dailyBudgetUsd: opts.budgetUsd ?? 0.5,
    dailyTokenBudget: 40_000,
  });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const wallet = new Wallet(cfg, memory);
  const voice = opts.voice === undefined ? new FakeVoice() : opts.voice;
  const delivered: string[] = [];
  const e = new HuntEngine(cfg, {
    voice: voice as unknown as Voice,
    memory,
    wallet,
    nowIso: frozenNow("2026-11-26T18:00:00.000Z"),
    collect: fixtureCollector(preys()),
    deliver: async (g) => {
      delivered.push(g.kind);
    },
  });
  return { e, memory, wallet, voice, delivered };
}

test("brings GPUs and tofus and spends no tokens on leaves", async () => {
  const { e, memory, voice } = await engine();
  const out = await e.hunt("manual");
  assert.equal(out.ran, true);
  const kinds = out.gifts.map((g) => g.kind).sort();
  assert.deepEqual(kinds, ["gpu", "gpu", "leaf"]);
  // Dos llamadas al modelo (GPU = 2, hoja = 0): la hoja no gastó voz.
  assert.equal((voice as FakeVoice).calls.length, 2);
  assert.equal(memory.state.gifts.length, 3);
});

test("does not repeat the same finding on the same day", async () => {
  const { e, memory } = await engine();
  await e.hunt("manual");
  const before = memory.state.gifts.length;
  const out = await e.hunt("manual");
  assert.equal(out.gifts.length, 0, "el gato no repite regalo el mismo día");
  assert.equal(memory.state.gifts.length, before);
});

test("with an empty wallet it does not hunt", async () => {
  const { e, memory } = await engine({ budgetUsd: 0 });
  memory.recordCharge(0.2);
  const out = await e.hunt("manual");
  assert.equal(out.ran, false);
  assert.match(out.reason ?? "", /budget/);
});

test("if delivery fails, the gift still lands in the lair", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-hunt-deliver-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const wallet = new Wallet(cfg, memory);
  const e = new HuntEngine(cfg, {
    voice: new FakeVoice() as unknown as Voice,
    memory,
    wallet,
    nowIso: frozenNow("2026-11-26T18:00:00.000Z"),
    collect: fixtureCollector(preys()),
    deliver: async () => {
      throw new Error("sin push");
    },
  });
  const out = await e.hunt("manual");
  assert.ok(out.gifts.length > 0);
  assert.ok(memory.state.gifts.length > 0);
});

test("spend accumulates in the cat's acta", async () => {
  const { e, wallet, memory } = await engine();
  await e.hunt("manual");
  wallet.charge(0.25, 0);
  assert.equal(memory.state.spentUsd, 0.25);
  assert.equal(memory.spentTodayUsd(), 0.25);
});
