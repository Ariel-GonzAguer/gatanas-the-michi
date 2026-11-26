/**
 * La dieta de Gatanás, probada sin tocar el disco. prrrr.
 *
 * La regla de oro: si esto falla, el gato te trae hojas de árbol cuando hay
 * un incendio, o GPUs cuando el Sprite está perfecto. Ambas son tragedias.
 * Los títulos de presa que entran aquí son los que produce `collect.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseGift, judgeHeuristic, type DietInput } from "../src/diet.js";
import type { Prey, PreyCategory } from "../src/prey.js";

function prey(category: PreyCategory, title: string, evidence = "", sightings = 1): Prey {
  return {
    key: `${category}:${title}`,
    category,
    title,
    evidence,
    host: "this Sprite",
    sightings,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

function input(p: Prey, overrides: Partial<DietInput> = {}): DietInput {
  return { prey: p, liveServices: 1, livesRemaining: 9, ...overrides };
}

test("disk at 95% is a GPU, with high confidence", () => {
  const v = judgeHeuristic(input(prey("disk", "disk at 95.2%", "free 0.3 GB")));
  assert.ok(v);
  assert.equal(v.kind, "gpu");
  assert.ok(v.confidence >= 0.9);
});

test("disk at 85% is tofu after two nights; a leaf on the first", () => {
  const fresh = judgeHeuristic(input(prey("disk", "disk at 85.0%")));
  const stale = judgeHeuristic(input(prey("disk", "disk at 85.0%", "", 2)));
  assert.equal(fresh?.kind, "leaf");
  assert.equal(stale?.kind, "tofu");
});

test("disk at 40% isn't even worth a leaf", () => {
  const v = judgeHeuristic(input(prey("disk", "disk at 40.0%")));
  assert.equal(v?.kind, "leaf");
});

test("a stopped service is a GPU; the cat novels the restart", () => {
  const v = judgeHeuristic(input(prey("service", "service web stopped")));
  assert.equal(v?.kind, "gpu");
  assert.match(v?.practical ?? "", /restart/);
});

test("fresh errors: three are tofu, eight are a GPU", () => {
  const three = judgeHeuristic(input(prey("log", "fresh errors in web.log", "error\nx\nerror\ny\nerror")));
  const eight = judgeHeuristic(
    input(prey("log", "fresh errors in web.log", Array(8).fill("fatal: no").join("\n"))),
  );
  assert.equal(three?.kind, "tofu");
  assert.equal(eight?.kind, "gpu");
});

test("a one-night zombie is a leaf; a three-night zombie is tofu", () => {
  const fresh = judgeHeuristic(input(prey("process", "zombie process node")));
  const old = judgeHeuristic(input(prey("process", "zombie process node", "", 3)));
  assert.equal(fresh?.kind, "leaf");
  assert.equal(old?.kind, "tofu");
});

test("an unknown category leaves the cat doubting (null)", () => {
  assert.equal(judgeHeuristic(input(prey("campaign", "something odd"))), null);
});

test("if the human rejected tofu twice, the cat switches to the leaf", () => {
  const p = prey("disk", "disk at 85.0%", "", 2);
  const inputV = input(p, { rejectedKinds: ["tofu", "tofu"] });
  const v = chooseGift(inputV, judgeHeuristic(inputV));
  assert.equal(v.kind, "leaf");
});

test("with no lives left, a GPU becomes tofu: the cat won't promise what it can't care for", () => {
  const v = chooseGift(input(prey("service", "service web stopped"), { livesRemaining: 0 }), null);
  assert.equal(v.kind, "tofu");
  assert.match(v.reason, /lives/);
});

test("a full litter box is always a GPU", () => {
  const v = judgeHeuristic(input(prey("arena", "litter box (/tmp) full")));
  assert.equal(v?.kind, "gpu");
});
