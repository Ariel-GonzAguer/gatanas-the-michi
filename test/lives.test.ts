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

test("nace con nueve vidas", async () => {
  const { lives } = await fresh();
  assert.equal(lives.state.livesRemaining, 9);
});

test("tirar algo de la mesa cuesta una vida", async () => {
  const { lives } = await fresh();
  const ev = await lives.loseLife("tiró una taza");
  assert.ok(ev);
  assert.equal(lives.state.livesRemaining, 8);
  assert.match(NineLives.narrative(ev!), /tiró algo/);
});

test("gastar una vida restaura el checkpoint y registra el evento", async () => {
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

test("si la restauración falla, la vida se devuelve", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-lives-fail-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const lives = new NineLives(cfg, memory, fakeSpritesApi({ fail: true }));
  await lives.takeCheckpoint("antes del desastre");
  await assert.rejects(() => lives.spendLife("intento fallido"));
  assert.equal(lives.state.livesRemaining, 9, "no hay vida para quien no revive");
});

test("sin llave del plano de control no hay restauración", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gatanas-lives-nokey-"));
  const cfg = loadConfig({ home: dir, lives: 9 });
  const memory = new Memory(path.join(dir, "memory.json"), "Gatanás The Michi");
  await memory.load();
  const lives = new NineLives(cfg, memory, null);
  assert.equal(await lives.spendLife("sin llave"), null);
  assert.equal(await lives.takeCheckpoint("sin llave"), null);
});

test("renacer devuelve las nueve vidas y no borra los regalos", async () => {
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
  const ev = await lives.reincarnate("recargó la arena");
  assert.equal(lives.state.livesRemaining, 9);
  assert.equal(memory.state.gifts.length, 1);
  assert.match(NineLives.narrative(ev), /Nueve vidas/);
});
