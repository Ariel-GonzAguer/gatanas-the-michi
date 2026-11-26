# Data flows

Three flows concentrate almost all of the agent's behavior: the hunt, the
conversation, and the daily rumination. All three write to the same acta —
the cat's persistent record (`memory.json`) — and go through the wallet
before spending tokens.

## 1. Hunt flow

Trigger: the `Scheduler` every `GATANAS_HUNT_INTERVAL_SEC` (900 s),
`POST /api/hunt`, or `node dist/cli.js hunt`.

```
┌──────────┐   ┌────────────┐   ┌──────────┐   ┌───────────┐
│ Scheduler │──→│ HuntEngine │──→│  collect │──→│   diet    │
│  (cron)   │   │  .hunt()   │   │ prey     │   │ GPU/leaf/ │
└──────────┘   └─────┬──────┘   └──────────┘   │  tofu     │
                     │                          └─────┬─────┘
        ┌────────────▼──────────────────────────────────▼───────┐
        │ trustworthy leaf? → fallbackNarration (0 tokens)      │
        │ else → narrateGift → Voice → gateway → OpenRouter     │
        └────────────┬──────────────────────────────────────────┘
                     │
        ┌────────────▼──────────┐   ┌───────────────────────┐
        │ memory.addGift + save │──→│ deliver (optional)    │
        │ giftedKeys[day]       │   │ the lair always gets  │
        └───────────────────────┘   └───────────────────────┘
```

Steps:

1. `Wallet.canSpend()` decides whether the round starts (the daily cap and
   the key's cap; see [the wallet](../features/monedero.md)). If it doesn't
   authorize, the hunt doesn't run and the reason lands in the log.
2. `collectLocalPrey` inventories the system itself: disk percentage, the
   sandbox (`/tmp` > 512 MiB), zombie processes from `/proc`, fresh errors
   in recent logs.
3. `judgeHeuristic` + `chooseGift` classify each find. The model takes no
   part in the classification.
4. Tree leaves with high confidence are narrated from the local repertoire
   (zero tokens). GPUs and tofus are narrated with `Voice.chat("meow", ...)`.
5. Every gift enters the acta and marks `giftedKeys[prey.key] = today` so
   the same gift isn't repeated on the same day.
6. `deliver` (Pushover via connector, if configured) can never fail the
   hunt: its error is logged and the gift still lands in the lair.

## 2. Conversation flow

Trigger: `POST /api/chat`.

```
message ──→ speak() ──→ canned intent? ──yes──→ local reply
                         │
                         no
                         ▼
              prompt with acta context
              (lives, purrs, gifts, previous opinion)
                         │
                         ▼
              Voice.chat("chat") ──→ google/gemma-4-31b-it:free
                         │ 429 or empty
                         ▼
              z-ai/glm-5.3-flash (paid, last resort)
                         │
                         ▼
              stripMarkdown ──→ reply JSON
```

Key details:

- The canned intents are bilingual on the trigger (the human can type in
  either language) and English in the reply: `acarici*|caricia|pet|scratch`,
  `churu*|atún|comida|tuna|food|feed`, `cómo estás|how are you|what's up`,
  `qué haces|what do you do`. They are answered without spending tokens.
- The model chain lives in `Voice.chat`: for the `chat` task it tries the
  assigned model and then `chatModelFallbacks`. Each link absorbs upstream
  429s and empty replies from models that reason.
- The cat's previous opinion travels inside the user prompt, not as an
  `assistant` turn: injecting it as its own turn degraded the replies
  (see [troubleshooting](../deployment/troubleshooting.md)).
- If the whole chain fails, `tiredReply()` answers with character instead
  of an empty string.

## 3. Rumination flow (daily opinion)

Trigger: the `Scheduler` at startup and then every hour; `shouldRuminate`
only lets one rumination through per calendar day.

```
Scheduler (every 1 h) ──→ shouldRuminate ──→ ruminate(voice, input)
                                                        │
                        ┌───────────────────────────────┘
                        ▼
             prompt: gifts, purrs, purr drought,
             remaining budget, previous opinion
                        │
                        ▼
             memory.setOpinion(quote) ──→ painted in the lair
```

- `input.purrDrought` is the days since the last purr (`Memory.purrDrought`).
- The confession always starts with the prefix
  `CONFESSION_PREFIX = "My opinion of my human:"` and evolves: there are
  different replies for zero purrs, a majority of tofus, delivered GPUs,
  or a house that's "too clean".
- The deterministic template (`fallbackOpinion`, used when the cat is out
  of voice) is singular/plural aware: "1 valuable thing" vs
  "N valuable things".

## References

- [Hunt and diet](../features/caza-y-dieta.md)
- [The lair and chat](../features/altar-y-chat.md)
- Source files: `src/hunt.ts`, `src/chat.ts`, `src/opinion.ts`, `src/scheduler.ts`
