# Quickstart — map of the wiki

Gatanás The Michi: a feline personal agent that lives inside a Fly.io
Sprite, hunts for problems on its own machine, narrates them with an LLM
through the connector gateway, and stores everything in its acta (its
persistent record). Node 24 + TypeScript, zero runtime dependencies.

## Quick start (local)

1. `npm install` (only `typescript` and `@types/node` as devDependencies).
2. `npm run build`.
3. `npm test` — 43 tests with no network and no real disk.
4. `GATANAS_HOME=/tmp/gato PORT=8099 GATANAS_HUNT_INTERVAL_SEC=0 npm start`
   — the lair is up at `http://localhost:8099`.
5. Give the cat a churu:
   `curl -X POST http://localhost:8099/api/churus` (the deterministic
   `churusReply()` answers).
6. To operate the real one: `SPRITES_TOKEN=… bash scripts/deploy.sh`
   (see [deployment](deployment/platform.md)).

## Stack at a glance

| Layer | Technology |
|------|------------|
| Language | TypeScript 5.6 → ESM (`tsc`, no bundler) |
| Runtime | Node 24 (>= 22.6 for `--experimental-strip-types`) |
| Server | Stock `node:http`, inline HTML/CSS/JS |
| Tests | `node --test` + `node:assert/strict` |
| Platform | Fly.io Sprites (service managed by `sprite-env`) |
| LLM | OpenRouter via the connector gateway (chat: `:free` models with a paid fallback) |
| Persistence | `memory.json` on the Sprite's persistent disk |

## Map of the wiki

### Architecture
- [Overview](architecture/overview.md) — layers, full module inventory, decisions.
- [HTTP API](architecture/routing.md) — the lair's routes, errors, rate limiters, headers.
- [Data flows](architecture/data-flow.md) — hunt, conversation, rumination.

### Highlighted features
- [Hunt and diet](features/hunting-and-diet.md) — GPU/leaf/tofu heuristic with exact thresholds.
- [Nine lives](features/nine-lives.md) — Sprite checkpoints as lives; the acta survives rewinding.
- [Wallet](features/wallet.md) — budget against the key's cap; the cat fasts.
- [The lair and chat](features/the-lair-and-chat.md) — the public page and the chat's model chain.
- [Repo self-publishing](features/self-publishing-on-github.md) — commits through the GitHub API via the OAuth connector.

### Security
- [Implementation](security/implementation.md) — HTTP perimeter, escaping, BYOK custody, model limits.

### Deployment and operation
- [Platform](deployment/platform.md) — the Sprite, the service, the deploy, persistence.
- [Troubleshooting](deployment/troubleshooting.md) — real incidents with cause and solution.

### Development
- [Testing](development/testing.md) — suite, doubles, conventions.
- [Workflow](development/workflow.md) — scripts, compilation, post-deploy smoke.

## Next steps for new devs

1. Read [architecture](architecture/overview.md) to locate the 19 modules.
2. Run `npm test` and read `test/diet.test.ts`: it pins the core contract.
3. Look at [data flows](architecture/data-flow.md) before touching
   `hunt.ts` or `chat.ts`.
4. To operate on the real Sprite, [deployment](deployment/platform.md) and
   [troubleshooting](deployment/troubleshooting.md) are mandatory.
