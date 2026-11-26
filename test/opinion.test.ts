/**
 * La opinión determinista (singular/plural) y las frases de churu: texto
 * plano, sin LLM. También el contador de churus del acta, ida y vuelta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONFESSION_PREFIX, fallbackOpinion } from "../src/opinion.js";
import { churusReply } from "../src/narrate.js";
import { Memory, type GatanasMemory } from "../src/memory.js";
import type { Gift } from "../src/prey.js";

function mkMemory(gifts: Pick<Gift, "kind">[]): GatanasMemory {
  return {
    schema: 1,
    createdAt: new Date().toISOString(),
    name: "Gatanás",
    gifts: gifts.map((g, i) => ({
      id: `g${i}`,
      kind: g.kind,
      preyKey: `k${i}`,
      preyTitle: "test prey",
      narration: "prrrr.",
      advice: "",
      huntNotes: "",
      tokens: 0,
      host: "h",
      at: new Date().toISOString(),
    })),
    livesRemaining: 9,
    lifeEvents: [],
    checkpoints: [],
    purrs: 3,
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
  };
}

function input(memory: GatanasMemory) {
  return { memory, nowIso: new Date().toISOString(), purrDrought: 0, budgetLeft: 1 };
}

test("the deterministic opinion uses singular for one GPU", () => {
  const quote = fallbackOpinion(input(mkMemory([{ kind: "gpu" }])));
  assert.ok(quote.startsWith(CONFESSION_PREFIX));
  assert.match(quote, /I brought them 1 valuable thing\./);
  assert.ok(!quote.includes("valuable things"));
});

test("the deterministic opinion uses plural for several GPUs", () => {
  const quote = fallbackOpinion(input(mkMemory([{ kind: "gpu" }, { kind: "gpu" }, { kind: "leaf" }])));
  assert.match(quote, /I brought them 2 valuable things\./);
});

test("the deterministic opinion uses singular for one tofu (a delicacy)", () => {
  const quote = fallbackOpinion(input(mkMemory([{ kind: "tofu" }])));
  assert.match(quote, /I brought them 1 fermented tofu\./);
  assert.ok(!quote.includes("tofus"));
});

test("the churu lines purr and don't repeat back to back", () => {
  const first = churusReply(1);
  assert.match(first, /First churu/);
  const second = churusReply(2);
  const third = churusReply(3);
  assert.match(second, /prrrr|miau/);
  assert.notEqual(second, third);
  assert.notEqual(first, second);
});

test("the churu counter lives in the acta and survives a re-read", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-churus-"));
  const file = path.join(dir, "memory.json");
  const memory = new Memory(file, "Gatanás");
  await memory.load();
  memory.giveChurus();
  memory.giveChurus();
  await memory.save();
  const again = new Memory(file, "Gatanás");
  const state = await again.load();
  assert.equal(state.churus, 2);
  assert.ok(state.lastChurusAt);
  await fs.rm(dir, { recursive: true, force: true });
});
