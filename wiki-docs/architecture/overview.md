# Architecture — overview

Gatanás The Michi is a personal agent that lives inside a Fly.io Sprite:
a single Node process that serves a web page (the lair — the code keeps the
legacy `altar` naming), hunts for problems on its own machine, and chats
through an LLM. No frameworks, no CDNs, no frontend build: just TypeScript
compiled to plain ESM.

## 1. Summary

The system has three layers: event ingress (HTTP and timers), the feline
domain (hunting, diet, lives, wallet, opinion), and infrastructure
(Sprites APIs and acta persistence). Every business decision is
deterministic and local; the language model only does the wording, it never
decides.

## 2. Components

Full inventory of the source code in `src/`.

| Module | Location | Description |
|--------|-----------|-------------|
| `main` | `src/main.ts` | Process entry point: assembles the runtime, opens port 8080, starts the pulse, and handles SIGTERM/SIGINT. |
| `altar-server` | `src/altar-server.ts` | Stock HTTP server: the lair, the JSON API, rate limiters, and security headers. |
| `altar` | `src/altar.ts` | The lair's single page (legacy naming): HTML+CSS+JS inline, no external dependencies. |
| `scheduler` | `src/scheduler.ts` | The pulse: hunt rounds every `huntIntervalSec`, wake probes every 30 s, daily rumination, revive windows. |
| `hunt` | `src/hunt.ts` | The hunting engine (`HuntEngine`): orchestrates collection, diet, narration, and the lair. |
| `collect` | `src/collect.ts` | Collects prey from the system itself: disk, `/tmp`, zombie processes, logs with fresh errors. |
| `diet` | `src/diet.ts` | Heuristic that classifies each find as GPU, tree leaf, or fermented tofu. |
| `prey` | `src/prey.ts` | Prey and gift types, `preyKey`, labels, the lair's SVG glyphs. |
| `narrate` | `src/narrate.ts` | The cat's `PERSONA`, gift narration (with a local fallback repertoire), and the deterministic `churusReply()` reactions. |
| `chat` | `src/chat.ts` | Conversation: canned intents and calls to the model with acta context. |
| `opinion` | `src/opinion.ts` | Daily rumination: the persistent confession about the human. |
| `opinion-types` | `src/opinion-types.ts` | Opinion types, split out to break circular dependencies. |
| `lives` | `src/lives.ts` | `NineLives`: Sprite checkpoints as lives, restoration, and rebirth. |
| `memory` | `src/memory.ts` | The acta (the cat's persistent record): JSON with atomic writes (tmp + rename). |
| `wallet` | `src/wallet.ts` | The wallet: real spend in USD against the OpenRouter key's cap. |
| `config` | `src/config.ts` | Environment-variable configuration with sensible defaults. |
| `cli` | `src/cli.ts` | Terminal: `hunt`, `altar`/`guarida`, `lives`, `meow`, `churus`, `revive` (alias `nahualada`). |
| `github-publish` | `src/github-publish.ts` | Publishes the repo itself through the GitHub API via the OAuth connector. |
| `deliver` | `src/deliver.ts` | Gift delivery (optional Pushover via connector; the lair is the default destination). |
| `types` | `src/types.ts` | Re-exports of public types for external consumers and tests. |

## 3. How the layers relate

```
┌──────────────────────────── ingress ────────────────────────────┐
│  HTTP (altar-server)      Scheduler (cron)      CLI (cli.ts)    │
└──────┬────────────────────────┬────────────────────┬──────────┘
       │                        │                    │
┌──────▼────────────────────────▼────────────────────▼──────────┐
│                        the feline domain                       │
│  HuntEngine → collect → diet → narrate → memory.addGift        │
│  speak / ruminate / Wallet.canSpend / NineLives                │
└──────┬────────────────────────┬───────────────────────────────┘
       │                        │
┌──────▼─────────┐   ┌─────────▼──────────┐   ┌────────────────┐
│ Voice (habitat) │   │ SpritesApi (habitat)│  │ Memory (acta)  │
│ connector       │   │ control plane       │  │ memory.json    │
│ gateway         │   │ checkpoints/exec    │  │ on disk        │
└─────────────────┘   └────────────────────┘   └────────────────┘
```

- `Voice` talks to the Sprites connector gateway, which attaches the
  OpenRouter API key according to the Sprite's identity. The process never
  sees the key.
- `SpritesApi` uses `SPRITES_TOKEN` (optional) for checkpoints, services,
  and exec: without the token, the cat hunts and chats but cannot die or
  revive.
- `Memory` writes to `GATANAS_HOME/memory.json` with a write queue and
  atomic rename: a power cut in the middle of a nahualada does not corrupt
  the acta.

## 4. Decisions and conventions

- **Zero runtime dependencies**: `dependencies` is empty in
  `package.json`; everything uses the Node standard library. The deploy
  does not run `npm install` on the Sprite.
- **The model doesn't decide**: `diet.ts` classifies with pure heuristics;
  the LLM only words the narration. A false rule from the model cannot
  turn a leaf into a GPU.
- **Frugality as character**: tree leaves spend no tokens
  (`fallbackNarration`); the wallet puts the brakes on hunting when spend
  gets close to the key's cap.
- **Strict ESM**: imports with the `.js` extension, `type: module`,
  `verbatimModuleSyntax`. TypeScript compiles to `dist/` with `tsc`.
- **Testable determinism**: `HuntEngine`, `Memory`, and `collectLocalPrey`
  receive their collaborators by injection; the tests use doubles
  (see [testing](../development/testing.md)).

## 5. Common problems

Operational incidents (empty replies from the model, 429s from the free
models, acta edits clobbered by SIGTERM) are documented with cause and
solution in [troubleshooting](../deployment/troubleshooting.md).

## References

- [Data flows](data-flow.md)
- [HTTP API](routing.md)
- [Hunt and diet](../features/caza-y-dieta.md)
- Source file: `src/main.ts`
- Configuration: `src/config.ts`, `.env.example`
