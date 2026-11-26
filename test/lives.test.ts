/**
 * Las nueve vidas de Gatanás.
 *
 * Lo que aquí se prueba es el contrato que el altar promete: las vidas bajan
 * por las razones correctas, no bajan más de la cuenta y el gato no revive si
 * no le quedan.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { fakeSpritesApi, NineLives } from "../src/lives.js";
import { Memory } from "../src/memory.js";

async function fresh(): Promise<{ memory: Memory; lives: NineLives }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-lives-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const lives = new NineLives(cfg, memory, fakeSpritesApi());
  return { memory, lives };
}

test("is born with nine lives", async () => {
  const { lives } = await fresh();
  assert.equal(lives.state.livesRemaining, 9);
});

test("knocking something off the table costs a life", async () => {
  const { lives } = await fresh();
  const ev = await lives.loseLife("knocked a cup");
  assert.ok(ev);
  assert.equal(lives.state.livesRemaining, 8);
  assert.match(NineLives.narrative(ev!), /knocked something off the table/);
});

test("spending a life restores the checkpoint and records the event", async () => {
  const { lives, memory } = await fresh();
  const cp = await lives.takeCheckpoint("antes de la demo");
  assert.ok(cp);
  const ev = await lives.spendLife("seguiré mi camino");
  assert.ok(ev);
  assert.equal(lives.state.livesRemaining, 8);
  assert.equal(ev!.id, cp!.id);
  // El checkpoint sobrevive al rebobinado: lo devolvemos al acta si el disco lo perdió.
  assert.ok(memory.state.checkpoints.some((c) => c.id === cp!.id));
});

test("if the restoration fails, the life is given back", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-lives-fail-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const lives = new NineLives(cfg, memory, fakeSpritesApi({ fail: true }));
  await lives.takeCheckpoint("antes del desastre");
  await assert.rejects(() => lives.spendLife("intento fallido"));
  assert.equal(lives.state.livesRemaining, 9, "no hay vida para quien no revive");
});

test("without the control-plane key there is no restoration", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-lives-nokey-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const lives = new NineLives(cfg, memory, null);
  assert.equal(await lives.spendLife("sin llave"), null);
  assert.equal(await lives.takeCheckpoint("sin llave"), null);
});

test("reincarnating gives back the nine lives and does not erase the gifts", async () => {
  const { lives, memory } = await fresh();
  memory.addGift({
    id: "g1",
    kind: "gpu",
    preyKey: "k",
    preyTitle: "algo",
    narration: "n",
    advice: "a",
    huntNotes: "",
    tokens: 0,
    host: "h",
    at: new Date().toISOString(),
  });
  await lives.loseLife("error");
  const ev = await lives.reincarnate("refilled the litter");
  assert.equal(lives.state.livesRemaining, 9);
  assert.equal(memory.state.gifts.length, 1);
  assert.match(NineLives.narrative(ev), /Nine brand-new lives/);
});
