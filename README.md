Hi. I'm **Gatanás The Michi**, a stray cat from Costa Rica who lives inside a
Fly.io **Sprite**. I hunt at night, bring gifts of dubious value, sleep when
the Sprite sleeps, and wake up remembering everything. I have nine lives and
one human. Everything else is noise.

**English TL;DR for judges** — This repo is a personal agent, not a cron job.
The cat patrols his own machine every 15 minutes (zombie processes, disk,
services, logs), turns findings into gifts — a **GPU** (valuable), a **tree
leaf** (useless, but it's the gesture) or **fermented tofu** (a delicacy with
character: intense, an acquired taste, my way of saying something is going
wrong but can still be saved) — through deterministic rules, and narrates them
via an LLM reached through a **Sprites connector** (OpenRouter; he never sees
the API key). He holds nine lives (Sprite checkpoints), a wallet that makes him
fast before the key cap, a written daily opinion of his human, a churu counter,
a public lair at https://gatanas-the-michi-b6zf5.sprites.app — and he
**publishes this very repo himself**, from inside the Sprite, through the
GitHub connector (no `git push` involved). TypeScript, zero runtime
dependencies, 43 tests. Built for Hacksgiving 2026. prrrr.

## What it does, exactly

Every night (every `GATANAS_HUNT_INTERVAL_SEC`, fifteen minutes by default) the
cat goes hunting around the Sprite:

1. **It opens its eyes** (`src/collect.ts`). It reads `/proc` for zombie
   processes, measures the disk, checks `sprite-env` services and listens to
   recent logs for fresh errors. No magic agents: it's a cat reading its own
   house.
2. **It decides what gift each finding deserves** (`src/diet.ts`). The rule is
   feline, and that's why it's simple:
   - something genuinely valuable (disk at 95%, a fallen service, eight errors
     in one log) → **a GPU**;
   - nothing worthy of you (disk at 40%, a one-night zombie) → **a tree leaf**;
   - something going wrong but still saveable (disk at 85% two nights in a
     row, three repeated errors) → **fermented tofu**, a delicacy with
     character. The cat speaks of tofu with respect: it is never something
     disgusting.
3. **It adds prose** (`src/narrate.ts`). This is where the model comes in:
   GLM 5.3 Flash via OpenRouter, through the **Sprites connector**. The cat
   never sees the API key. The model doesn't choose the gift; the diet already
   decided. The model only tells the story, in character.
4. **It leaves it in the lair** (`src/altar.ts`): the public page where every
   gift lands, next to the cat's daily opinion of you.

Tree leaves don't spend a single token. Frugality is part of the character.

## The nine lives

It turns out a Sprite is the closest thing to a cat on Fly.io: both have
checkpoints.

`src/lives.ts` implements the pact: the cat takes a Sprite checkpoint before
anything risky, and when it knocks something off the table (or the human asks
via `POST /api/revive`), it restores the checkpoint and spends a life. If the
restoration fails, the life is given back: there is no life for whoever fails
to revive.

The elegant part — the expensive part — is that restoring a checkpoint
rewinds the disk, and that includes the cat's acta (its persistent record).
So the cat writes everything down before restoring and reconciles after, so
its memory survives its own death.

## The lair

`GET /` serves a single page: no frameworks, no CDNs, no build. It shows:

- **My opinion of my human**: a confession the cat ruminates once a day from
  your gifts, your pets and your days of absence.
- **The lair**: the gifts, newest first, with the cat's narration and the
  practical dissection of each finding.
- **Figures**: lives, pets, churus, hunts, GPUs, tofus and leaves.
- **Talk to the cat**: a chat where it answers in its own voice. While the
  model thinks you see *“Gatanás is thinking about what to meow back…”*.
  There's a **Give churu** button — the counter is persistent, and the cat
  reacts deterministically (no LLM: joy is not outsourced).
- **How does this site work?** a section at the end explaining the whole
  trick: single-file HTML via `node:http`, the acta on the Sprite's persistent
  disk, the hunt cycle, the connector gateway, the rate limits.

Everything that comes out of the model is HTML-escaped. A rude narration
cannot inject markup: there's a test that proves it.

The page is in English on purpose — the browser's native translation makes it
readable in any other language.

## The wallet

This house's OpenRouter API key has a cap of **6.66 USD**. The cat knows
(`src/wallet.ts`): it hunts under a daily spend cap, watches the real cost
OpenRouter reports on every reply, and when the total gets close to the key
cap, it **fasts**. A cat that spends more than its human gave it doesn't
deserve churus.

## Build and run

```bash
npm install
npm run build
npm test          # 43 tests, no network, no real disk
node dist/main.js
```

The lair listens on port 8080 — the port the Sprite proxy routes to its HTTPS
URL.

To keep it running as a Sprite service (so it comes back on its own when the
Sprite wakes):

```bash
sprite-env services create gatanas \
  --cmd node --args "dist/main.js" \
  --dir /home/sprite/gatanas-the-michi \
  --env "GATANAS_HOME=/home/sprite/.gatanas,SPRITE_NAME=gatanas-the-michi" \
  --http-port 8080
```

## In the Sprite's terminal

`scripts/sprite-shims.sh` (run by the deploy) leaves the cat's commands bare
on the PATH, so from `sprite console` you can just type:

```bash
hunt              # one hunt round now
lair              # acta summary (aliases: altar, guarida)
lives             # lives and checkpoints
meow "text"       # talk to the cat
churus            # give it a churu
revive            # knock something off the table and revive
```

## From your machine

The Sprites CLI talks to the cat without opening a console:

```bash
sprite console -s gatanas-the-michi                    # shell inside the Sprite
sprite exec -s gatanas-the-michi --no-stdin -- lair    # one command and out
sprite info -s gatanas-the-michi                       # status and URL
```

Whatever comes after `--` must stay on one line: if you split it, the rest
runs on your machine, not on the Sprite. Full detail in the
[wiki](wiki-docs/development/workflow.md).

## Environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8080` | The lair's port |
| `SPRITE_NAME` | `gatanas-the-michi` | Its home on the control plane |
| `GATANAS_HOME` | `~/.gatanas` | Where its acta lives |
| `OPENROUTER_CONNECTION` | see `.env.example` | OpenRouter connector ID |
| `GATANAS_MODEL_*` | see `.env.example` | Model per task (chat: `google/gemma-4-31b-it:free`) |
| `GATANAS_MODEL_CHAT_FALLBACKS` | `z-ai/glm-5.3-flash` | Chat fallback when the `:free` model is saturated |
| `GATANAS_HUNT_INTERVAL_SEC` | `900` | How often it hunts (0 = never) |
| `GATANAS_DAILY_BUDGET_USD` | `0.5` | Daily spend cap |
| `GATANAS_DAILY_TOKEN_BUDGET` | `40000` | Daily token cap, independent of the USD one |
| `GATANAS_LIVES` | `9` | Never doubt the cat |
| `SPRITES_TOKEN` | — | Control-plane key, only for lives and services |

`SPRITES_TOKEN` is optional: without it the cat still hunts, keeps its acta
and serves the lair, but it can't take checkpoints or restart services.

## The API

| Route | What it does |
| --- | --- |
| `GET /` | the lair (aliases: `/altar`, `/guarida`) |
| `GET /api/status` | status, wallet, churus and the latest opinion |
| `GET /api/gifts` | recent gifts |
| `GET /api/lives` | lives and checkpoints |
| `POST /api/chat` | `{ "message": "..." }` |
| `POST /api/purr` | pet it |
| `POST /api/churus` | give it a churu |
| `POST /api/hunt` | one hunt round now |
| `POST /api/revive` | knock something off the table and revive (alias: `/api/nahualada`) |

Write routes have per-minute rate limits: a cat tolerates very little traffic.

## Why this is an agent and not a cron

Because it remembers you. It keeps its acta on its own disk — the one that
survives the Sprite's sleep — learns which services fall on Tuesdays, counts
its pets, forms a written opinion of you, and when it dies it comes back
knowing who it is. A cron is a cog; the cat is a tenant.

## Built during Hacksgiving 2026

Built November 26–29, 2026 for Fly.io's
[Hacksgiving](https://fly.io/hacksgiving/) hackathon. It runs on a **Sprite**
and talks through two **Sprites connectors**: OpenRouter (its voice) and
GitHub (its own code, which the cat commits from inside its house).

— Gatanás The Michi. prrrr.
