/**
 * La dieta de Gatanás, probada sin tocar el disco. prrrr.
 *
 * La regla de oro: si esto falla, el gato te trae hojas de árbol cuando hay
 * un incendio, o GPUs cuando el Sprite está perfecto. Ambas son tragedias.
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
    host: "este Sprite",
    sightings,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

function input(p: Prey, overrides: Partial<DietInput> = {}): DietInput {
  return { prey: p, liveServices: 1, livesRemaining: 9, ...overrides };
}

test("disco al 95% es una GPU, con confianza alta", () => {
  const v = judgeHeuristic(input(prey("disk", "disco al 95.2%", "free 0.3 GB")));
  assert.ok(v);
  assert.equal(v.kind, "gpu");
  assert.ok(v.confidence >= 0.9);
});

test("disco al 85% es tofu si lleva dos noches; hoja si es la primera", () => {
  const fresh = judgeHeuristic(input(prey("disk", "disco al 85.0%")));
  const stale = judgeHeuristic(input(prey("disk", "disco al 85.0%", "", 2)));
  assert.equal(fresh?.kind, "leaf");
  assert.equal(stale?.kind, "tofu");
});

test("disco al 40% no vale ni una hoja", () => {
  const v = judgeHeuristic(input(prey("disk", "disco al 40.0%")));
  assert.equal(v?.kind, "leaf");
});

test("un servicio detenido es GPU; el gato lo novela con el reinicio", () => {
  const v = judgeHeuristic(input(prey("service", "servicio web detenido")));
  assert.equal(v?.kind, "gpu");
  assert.match(v?.practical ?? "", /restart/);
});

test("errores frescos: tres son tofu, ocho son GPU", () => {
  const three = judgeHeuristic(input(prey("log", "errores frescos en web.log", "error\nx\nerror\ny\nerror")));
  const eight = judgeHeuristic(
    input(prey("log", "errores frescos en web.log", Array(8).fill("fatal: no").join("\n"))),
  );
  assert.equal(three?.kind, "tofu");
  assert.equal(eight?.kind, "gpu");
});

test("un zombi de una noche es hoja; de tres noches es tofu", () => {
  const fresh = judgeHeuristic(input(prey("process", "proceso zombi node")));
  const old = judgeHeuristic(input(prey("process", "proceso zombi node", "", 3)));
  assert.equal(fresh?.kind, "leaf");
  assert.equal(old?.kind, "tofu");
});

test("una categoría desconocida deja al gato dudando (null)", () => {
  assert.equal(judgeHeuristic(input(prey("campaign", "algo raro"))), null);
});

test("si el humano rechazó tofu dos veces, el gato se pasa a la hoja", () => {
  const p = prey("disk", "disco al 85.0%", "", 2);
  const inputV = input(p, { rejectedKinds: ["tofu", "tofu"] });
  const v = chooseGift(inputV, judgeHeuristic(inputV));
  assert.equal(v.kind, "leaf");
});

test("sin vidas, un GPU se convierte en tofu: el gato no promete lo que no puede cuidar", () => {
  const v = chooseGift(input(prey("service", "servicio web detenido"), { livesRemaining: 0 }), null);
  assert.equal(v.kind, "tofu");
  assert.match(v.reason, /vidas/);
});

test("la arena llena es siempre una GPU", () => {
  const v = judgeHeuristic(input(prey("arena", "caja de arena (/tmp) llena")));
  assert.equal(v?.kind, "gpu");
});
