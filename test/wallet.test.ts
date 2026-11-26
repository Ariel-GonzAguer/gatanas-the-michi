/**
 * El monedero, sin red y sin disco real (el acta vive en un temp dir).
 *
 * Contrato:
 *  - el tope diario en USD frena la caza,
 *  - el tope diario de TOKENS también (40000 tokens = ayuna),
 *  - la reserva del tope de la llave deja postre para el humano,
 *  - charge() solo registra cuando OpenRouter reportó algo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { Memory } from "../src/memory.js";
import { Wallet } from "../src/wallet.js";

async function wallet(opts: { dailyUsd?: number; dailyTokens?: number } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-wallet-"));
  const cfg = loadConfig({
    home: dir,
    dailyBudgetUsd: opts.dailyUsd ?? 0.5,
    dailyTokenBudget: opts.dailyTokens ?? 40_000,
  });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  return { wallet: new Wallet(cfg, memory), memory };
}

test("an empty wallet lets the cat hunt", async () => {
  const { wallet: w } = await wallet();
  assert.deepEqual(w.canSpend(), { ok: true });
});

test("the daily USD cap stops the hunt", async () => {
  const { wallet: w, memory } = await wallet({ dailyUsd: 0.1 });
  memory.recordCharge(0.1);
  const verdict = w.canSpend();
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason ?? "", /today's budget/);
});

test("the daily token cap stops the hunt too", async () => {
  const { wallet: w, memory } = await wallet({ dailyTokens: 1000 });
  memory.recordTokens(1000);
  const verdict = w.canSpend();
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason ?? "", /token budget/);
});

test("the key cap keeps a reserve: the cat fasts before 6.66", async () => {
  const { wallet: w, memory } = await wallet({ dailyUsd: 10 });
  memory.recordCharge(6.16); // cap 6.66 - reserve 0.5
  const verdict = w.canSpend();
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason ?? "", /near its cap/);
});

test("charge ignores zero-cost replies but records real ones", async () => {
  const { wallet: w, memory } = await wallet();
  w.charge(0, 120); // una hoja narrada del repertorio: cero USD
  assert.equal(memory.state.spentUsd, 0);
  assert.equal(memory.tokensToday(), 120);
  w.charge(0.0002, 200);
  assert.ok(Math.abs(memory.state.spentUsd - 0.0002) < 1e-9);
});
