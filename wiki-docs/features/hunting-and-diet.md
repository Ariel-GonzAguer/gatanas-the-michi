# Feature: hunting and diet

Every so often the cat patrols its own machine, classifies each finding as a
gift, and narrates it. This is the heart of the agent: everything else (the
lair, the wallet, the lives) revolves around this hunt.

## What is it and why is it here?

A traditional monitoring agent sends alerts. Gatanás hunts: it decides which
finding deserves attention (GPU), which is straw (a tree leaf) and which is
rotting (fermented tofu). The classification is 100% heuristic and
deterministic; the LLM only supplies the prose. That separation is the central
design decision: a model hallucination can never inflate the severity of a
finding.

## How it works (technical flow)

```
cron 900s / POST /api/hunt / cli hunt
        │
        ▼
Wallet.canSpend() ──no──→ fasts (log + reason)
        │ yes
        ▼
collectLocalPrey ──→ [disk %, /tmp MB, zombies, fresh errors]
        │
        ▼
judgeHeuristic ──null──→ chooseGift degrades to leaf
        │ verdict
        ▼
chooseGift ──→ adjustments for previous rejections and lives
        │
        ├── reliable leaf ──→ fallbackNarration (0 tokens)
        └── gpu/tofu ──→ narrateGift ──→ Voice.chat("meow")
        │
        ▼
memory.addGift + giftedKeys[today] + memory.save
        │
        ▼
deliver (optional, never breaks the hunt)
```

Exact rules of the heuristic (`src/diet.ts`). The matched titles are the
literal strings emitted by `collect.ts`, kept in Spanish in the code:

| Category | Condition | Gift | Confidence |
|-----------|-----------|--------|-----------|
| `disk` | title `disco al N%` ("disk at N%") with N ≥ 92 | GPU | 0.95 |
| `disk` | N ≥ 80 and seen on 2+ nights | tofu | 0.85 |
| `disk` | N ≥ 80 first night | leaf | 0.85 |
| `process` | zombie with 3+ sightings | tofu | 0.85 |
| `process` | newborn zombie | leaf | 0.85 |
| `service` | title `detenido` ("stopped") and lives remain | GPU | 0.90 |
| `service` | title `detenido` ("stopped") with no lives left | tofu | 0.60 |
| `log` | title `errores frescos` ("fresh errors") with 8+ error matches | GPU | 0.95 |
| `log` | title `errores frescos` ("fresh errors") with 3+ matches | tofu | 0.85 |
| `log` | title `gigante` ("giant log") on 2+ nights | tofu | 0.85 |
| `arena` | always (`/tmp` > 512 MiB in `collect`) | GPU | 0.90 |
| `certificate` | title `vence` ("expires") | tofu | 0.85 |
| any | no rule applies | `null` → leaf | 0.40 |

`chooseGift` applies two corrections on top of the base verdict:

- Two tofus rejected by the human downgrade the next tofu to a leaf.
- A GPU with 0 lives remaining becomes a tofu: the cat does not promise
  care it cannot give.

## Files involved

| File | Role |
|---------|-----|
| `src/hunt.ts` | `HuntEngine`: orchestration, anti-reentrancy lock, cap of 9 prey per round. |
| `src/collect.ts` | `collectLocalPrey(deps, opts)`: system inventory with injectable dependencies. |
| `src/diet.ts` | `judgeHeuristic(input)` and `chooseGift(input, heuristic)`, pure functions. |
| `src/prey.ts` | The `Prey`/`Gift` types, `preyKey(category, host, title)`, labels and glyphs. |
| `src/narrate.ts` | `narrateGift(voice, ctx)` and `fallbackNarration(kind, prey)`. |
| `src/memory.ts` | `addGift`, `recordHunt`, the `giftedKeys` registry pruned to 30 days. |

## API / Public interface

```ts
// src/hunt.ts
export class HuntEngine {
  constructor(cfg: GatanasConfig, deps: HuntDeps)
  get busy(): boolean
  hunt(source: "cron" | "manual" | "request"): Promise<HuntOutcome>
}
export function fixtureCollector(preyList: Prey[]): (opts) => Promise<Prey[]>
export function timeOfDay(iso: string): string
```

| `HuntOutcome` field | Type | Description |
|------------------------|------|-------------|
| `ran` | `boolean` | Whether the round ran (false = fast or blocked). |
| `reason` | `string?` | Reason when it did not run. |
| `gifts` | `Gift[]` | Gifts of the round. |
| `found` | `number` | Prey detected. |
| `tokens` | `number` | Tokens spent on narration. |

Relevant environment variables: `GATANAS_HUNT_INTERVAL_SEC` (900),
`GATANAS_DAILY_BUDGET_USD` (0.5), `GATANAS_DAILY_TOKEN_BUDGET` (40000).

## External dependencies

- Sprites connector gateway → OpenRouter (narration for GPUs and tofus).
  No npm dependencies.

## Limitations and considerations

- The runtime logs (`/.sprite/logs`) are read-only for external processes:
  the real prey of the `log` category are the application logs in the home
  directory and in `/tmp` (see `collect.ts`, `candidateDirs`).
- The same finding is never gifted twice on the same day (`giftedKeys`);
  a leaf never repeats at all.
- The freshness window (`freshnessWindowSec`) filters out old findings;
  in demo mode (`GATANAS_DEMO=1`) it is shortened so scenes can be staged.

## References

- [Hunt flow](../architecture/data-flow.md)
- [Wallet](wallet.md)
- [Testing](../development/testing.md) (the diet is the heaviest suite)
- Source files: `src/hunt.ts`, `src/diet.ts`, `src/collect.ts`
