/**
 * El oído de Gatanás: la recolección, contra un sistema de archivos falso.
 *
 * Estas pruebas fijan el contrato de presas: qué es una presa y, más
 * importante, qué no lo es. Un gato que caza el ventilador cada noche no
 * gana nada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectLocalPrey, type CollectDeps } from "../src/collect.js";

interface Fake {
  files: Record<string, string>;
  sizes: Record<string, number>;
  mtimes: Record<string, number>;
  dirs: Record<string, { name: string; isDir: boolean; size: number }[]>;
  statfs?: { total: number; free: number };
}

function depsFrom(fake: Fake, nowMs = Date.now()): CollectDeps {
  return {
    now: () => nowMs,
    readFile: async (p) => {
      if (p in fake.files) return fake.files[p]!;
      throw new Error(`ENOENT ${p}`);
    },
    listDir: async (p) => fake.dirs[p] ?? [],
    stat: async (p) => {
      if (p in fake.sizes) return { size: fake.sizes[p]!, mtimeMs: fake.mtimes[p] ?? nowMs };
      return null;
    },
    procDir: "/proc",
    spriteDir: "/.sprite",
    tmpDir: "/tmp",
    homeDir: "/home/sprite",
  };
}

const NOW = 1_800_000_000_000;

test("disco por debajo del umbral: presa con su porcentaje", async () => {
  const fake: Fake = {
    files: { "/proc/self/mounts": "/dev/sda1 / ext4 rw 0 0\n" },
    sizes: {},
    mtimes: {},
    dirs: { "/proc": [], "/.sprite/services": [], "/.sprite/logs/services": [], "/tmp": [] },
  };
  const deps = { ...depsFrom(fake, NOW), statfs: async () => ({ total: 100, free: 2 }) };
  const out = await collectLocalPrey(deps, { host: "este Sprite", freshSec: 120 });
  const disk = out.find((p) => p.category === "disk");
  assert.ok(disk, "el gato debió ver el disco moribundo");
  assert.match(disk!.title, /disco al 98\.0%/);
});

test("un proceso zombi aparece; un proceso normal no", async () => {
  const zombieStat = `1234 (node) Z 1 1234 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 ${Math.floor(NOW / 10) - 100_000} 0`;
  const normalStat = `1235 (node) S 1 1235 1 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 ${Math.floor(NOW / 10) - 100_000} 0`;
  const fake: Fake = {
    files: {
      "/proc/1234/stat": zombieStat,
      "/proc/1235/stat": normalStat,
      "/proc/self/mounts": "/dev/sda1 / ext4 rw 0 0\n",
    },
    sizes: {},
    mtimes: {},
    dirs: {
      "/proc": [
        { name: "1234", isDir: true, size: 0 },
        { name: "1235", isDir: true, size: 0 },
        { name: "self", isDir: true, size: 0 },
      ],
      "/.sprite/services": [],
      "/.sprite/logs/services": [],
      "/tmp": [],
    },
  };
  const deps = { ...depsFrom(fake, NOW), statfs: async () => ({ total: 100, free: 90 }) };
  const out = await collectLocalPrey(deps, { host: "este Sprite", freshSec: 120 });
  const procs = out.filter((p) => p.category === "process");
  assert.equal(procs.length, 1);
  assert.match(procs[0]!.title, /zombi node/);
});

test("errores frescos en un log reciente: presa de categoría log", async () => {
  const log = "ok\nfatal: arriba\nok\nerror: abajo\nok\npanic: al final\n";
  const fake: Fake = {
    files: { "/proc/self/mounts": "/dev/sda1 / ext4 rw 0 0\n", "/.sprite/logs/services/web.log": log },
    sizes: { "/.sprite/logs/services/web.log": 200 },
    mtimes: { "/.sprite/logs/services/web.log": NOW - 10_000 },
    dirs: {
      "/proc": [],
      "/.sprite/services": [],
      "/.sprite/logs/services": [{ name: "web.log", isDir: false, size: 200 }],
      "/tmp": [],
    },
  };
  const deps = { ...depsFrom(fake, NOW), statfs: async () => ({ total: 100, free: 90 }) };
  const out = await collectLocalPrey(deps, { host: "este Sprite", freshSec: 120 });
  const logs = out.filter((p) => p.category === "log");
  assert.equal(logs.length, 1);
  assert.match(logs[0]!.evidence, /fatal: arriba/);
});

test("un log viejo no huele: no es presa", async () => {
  const fake: Fake = {
    files: {
      "/proc/self/mounts": "/dev/sda1 / ext4 rw 0 0\n",
      "/.sprite/logs/services/old.log": "error\nerror\nerror\n",
    },
    sizes: { "/.sprite/logs/services/old.log": 200 },
    mtimes: { "/.sprite/logs/services/old.log": NOW - 3_600_000 },
    dirs: {
      "/proc": [],
      "/.sprite/services": [],
      "/.sprite/logs/services": [{ name: "old.log", isDir: false, size: 200 }],
      "/tmp": [],
    },
  };
  const deps = { ...depsFrom(fake, NOW), statfs: async () => ({ total: 100, free: 90 }) };
  const out = await collectLocalPrey(deps, { host: "este Sprite", freshSec: 120 });
  assert.equal(out.filter((p) => p.category === "log").length, 0);
});
