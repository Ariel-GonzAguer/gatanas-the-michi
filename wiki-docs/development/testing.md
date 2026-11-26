# Testing

The suite runs on `node --test` (the standard library's test runner) over
the compiled test build. No testing dependencies: no vitest, no jest.

## 1. Summary

36 tests in 6 files, all with no network and no real disk: every module
with behavior receives its collaborators by injection and the tests use
doubles. `npm test` compiles and runs everything.

## 2. Command and configuration

```bash
npm test   # tsc -p tsconfig.test.json && node --test dist-test/test/*.test.js
```

`tsconfig.test.json` compiles `src/` + `test/` to `dist-test/` with
`rootDir` at the project root; the tests import from `../src/*.js`.

## 3. Files and coverage

| File | What it pins down | Tests |
|---------|----------|---------|
| `test/diet.test.ts` | The heuristic contract: exact disk thresholds (95% is a GPU with high confidence, 85% is tofu if it's been two nights / leaf on the first, 40% doesn't even make a leaf), errors (8 GPU / 3 tofu), zombies (3 sightings), the full sandbox that's always a GPU, a stopped service, unknown categories that leave the cat doubting, rejected tofus that degrade to leaf, and a GPU with no lives that drops to tofu. | 10 |
| `test/collect.test.ts` | What is prey and what isn't: disk measured with injectable `statfs`, zombies vs normal processes, fresh vs old logs. | 4 |
| `test/hunt.test.ts` | The full engine with a fake voice: no repeating a find on the same day, leaves without tokens, an empty wallet that puts the brakes on, a failed delivery that doesn't break the hunt, accumulated spend in the acta. | 5 |
| `test/lives.test.ts` | The pact of the lives: born with 9, losing costs 1, spending restores the checkpoint, the life is given back if the restore fails, without the key there is no restore, rebirth doesn't erase gifts. | 6 |
| `test/altar.test.ts` | The lair's HTTP contract: served at `/` and `/guarida`, JSON from `/api/status` and `/api/purr`, `POST /api/churus` incrementing the counter with distinct reactions, a meowing 404 for unknown routes, and HTML-escaped narrations (no injection from the model). | 6 |
| `test/opinion.test.ts` | The deterministic opinion: singular with one GPU, plural with several, singular with one tofu; churus lines that vary instead of repeating back-to-back; the churus counter living in the acta and surviving a re-read. | 5 |

## 4. Doubles and fixtures

| Double | Location | Use |
|-------|-----------|-----|
| `fixtureCollector(preyList)` | `src/hunt.ts` | Fixed prey collector for the engine. |
| `fakeSpritesApi({fail})` | `src/lives.ts` | Fake control plane with in-memory checkpoints. |
| `FakeVoice` | `test/hunt.test.ts` | Voice that records calls and answers with a fixed reply. |
| Injectable `deps.statfs` | `src/collect.ts` | Replaceable disk meter (`CollectDeps.statfs`). |
| `GATANAS_TEST_STATFS` | `src/collect.ts` | Environment-variable alternative. |

## 5. Conventions

- Asserts with `node:assert/strict`; `assert.deepEqual` for shape
  contracts (gift kinds) and `assert.match` for texts.
- Frozen dates (a fixed `nowIso`) in the engine tests so `giftedKeys` and
  freshness windows are deterministic.
- Per-test temporary directories (`fs.mkdtemp`) for the acta: the real
  `GATANAS_HOME` is never touched.

## 6. No configured tests (integration)

Real integration (the Sprites gateway, the control plane, OpenRouter) has
no automated suite: it's validated with the manual smoke documented in
[workflow](workflow.md) and with the lair's live endpoints.

## References

- [Hunt and diet](../features/caza-y-dieta.md) (the busiest suite)
- [Development workflow](workflow.md)
- Configuration: `tsconfig.test.json`, `package.json`
