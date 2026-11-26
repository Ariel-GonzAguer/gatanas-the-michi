# Feature: the lair and the chat

The lair (Spanish: *la guarida*) is the project's only page: a public URL
where the cat shows its acta, its opinion and its gifts, and where it can be
talked to or petted. No frameworks, no CDNs, no frontend build.

> **Naming note:** the source files keep the legacy "altar" naming —
> `src/altar.ts`, `src/altar-server.ts`, the `AltarSnapshot` type and
> `altarHtml()`. The public page concept itself is now called **the lair**.

## What is it and why is it here?

An agent that lives on a server needs a visible face. The design decision was
to build it as a single function that returns a complete HTML document with
inline CSS and JS: nothing to load, nothing to update, and the aesthetic
(street cat, old server, night) is part of the product.

## How it works (technical flow)

```
GET /  ──→  altar-server builds AltarSnapshot ──→ altarHtml(s) ──→ HTML
                                                            │
        (the page's inline JS)                              │
             │ POST /api/chat {message}                     │
             │ POST /api/purr                               │
             │ POST /api/churus                             │
             ▼                                              ▼
        speak() ──→ chain of models ──→ reply ──→ painted on the thread
```

Cat states on the page (decided by the server, painted by the client):

| State | Condition | ASCII cat |
|--------|-----------|------------|
| awake | fresh wakefulness probe and no revive window | `( o.o )` with golden eyes |
| asleep | fresh wakefulness but inside the window — does not happen except on revive | `( -.- )` zZz |
| reviving | no fresh probe (process down) or inside the revive window | `( x.x )` |

Sections of the page:

- **My opinion of my human**: the confession ruminated once a day. The
  deterministic template is singular/plural aware ("1 valuable thing" vs
  "N valuable things").
- **The lair**: up to 30 living gifts (rejected ones are not painted), each
  with an SVG glyph (golden GPU, leaf, tofu with character), narration, origin and a
  practical dissection.
- **Numbers**: lives, pets, churus, hunts, GPUs, tofus, leaves — the stats
  grid now includes a "churus" cell.
- **Live figures** (`GET /api/live`): a one-way SSE channel. The server keeps
  the set of subscribed visitors; every successful pet, churu, hunt or revive
  pushes a JSON snapshot to all of them, and a 5 s poll catches changes made
  by the cron or the CLI. The page flashes the changed counter, updates the
  lair and the opinion by re-fetching the server-rendered markup (no client
  templates, no injection surface), and slides the event into the thought
  ticker ("someone just fed the cat a churu."). Heartbeat every 25 s keeps
  the connections alive through proxies; the badge in the figures header
  shows live / reconnecting.
- **Talk to the cat**: chat thread + "Pet" button + "Give churu" button
  (next to "Pet"). The ASCII cat itself is a button: click it and you pet it.

The chat (`src/chat.ts`):

1. `cannedReply` answers common intents without spending tokens (pets,
   churus/food, "how are you", "what are you doing").
2. If it is not canned, it builds a prompt with the acta's real context
   (lives, pets, last gifts, the previous opinion as data, not as a turn)
   and calls `Voice.chat("chat", ...)`.
3. The chain of models: `google/gemma-4-31b-it:free` first and
   `z-ai/glm-5.3-flash` (paid) as the last resort. Each link absorbs
   upstream 429s and empty responses from reasoning models.
4. `stripMarkdown` cleans the model's prose before displaying it.
5. While the LLM is generating, the page shows a typing indicator —
   "Gatanás is thinking about what to meow back…" (the thread has
   `aria-live="polite"`) — removed as soon as the reply arrives. There is no
   streaming: the reply lands complete, with a cat's manners.

## Files involved

| File | Role |
|---------|-----|
| `src/altar.ts` | `altarHtml(snapshot)`: the full document; `esc()` for all dynamic text. |
| `src/altar-server.ts` | HTTP routes, rate limiters, headers, snapshot assembly. |
| `src/chat.ts` | `speak(voice, memory, text)` and the `cannedReply` intents. |
| `src/narrate.ts` | `PERSONA` (the cat's Costa Rican voice), `stripMarkdown` and `churusReply()`. |
| `src/opinion.ts` | The rumination that paints the opinion section. |
| `src/prey.ts` | `giftGlyph(kind)`: the lair's three inline SVGs. |

## API / Public interface

```ts
// src/altar.ts
export interface AltarSnapshot {
  name: string; memory: GatanasMemory; alive: boolean; awake: boolean;
  lastWatchAt: string | null; voiceOk: boolean; lives: number;
  purrDrought: number; now: string;
}
export function altarHtml(s: AltarSnapshot): string
```

Routes involved: `GET /` (the lair page; the aliases `/altar` and `/guarida`
resolve to it), `POST /api/chat`, `POST /api/purr`, `POST /api/churus`,
`GET /api/status` (now includes `churus`), `GET /api/gifts` (full table in
[routing](../architecture/routing.md)).

`POST /api/churus` gives the cat a churu: it increments `churus` /
`lastChurusAt` in `memory.json` and answers with a deterministic reply from
`churusReply()` in `src/narrate.ts` (no LLM involved). It is rate-limited to
30/min, like purr.

## External dependencies

- None for the frontend (everything is inline).
- The chat depends on the Sprites connector gateway → OpenRouter.

## Limitations and considerations

- The chat thread lives only in the browser (it is not persisted): reloading
  the page wipes it. Pets and gifts are persistent — churus are too.
- All dynamic text goes through `esc()`; there is a test that feeds
  narrations containing `<script>` and `<img onerror>` and verifies none of
  it reaches the HTML (see [testing](../development/testing.md)).
- The model can be slow; the Sprite's proxy may cut earlier (502) if the
  chain of models drags on. The chain is at most 2 links for that reason
  (see [troubleshooting](../deployment/troubleshooting.md)).

## The "How does this site work?" section

The page ends with a `<details>` element titled **"How does this site
work?"**, aimed at curious visitors (and judges). It explains that:

- The page is a single HTML file with its CSS and JS inside, served by
  `node:http` from the standard library: no frameworks, no CDNs, no build
  step, no cookies, no trackers. Everything on it is generated by the same
  Node process that is the cat.
- The data comes from the acta (`memory.json`), a small JSON file on the
  Sprite's persistent disk: gifts, pets, churus, lives and the cat's opinion
  of you. The disk survives the Sprite's sleeps, so the cat wakes up
  remembering everything.
- The hunt cycle runs every `GATANAS_HUNT_INTERVAL_SEC` (15 minutes by
  default): zombie processes, disk, services and logs. The diet picks the
  gift (GPU, tofu or leaf) with fixed rules; the LLM only narrates it.
- The chat travels through the **Sprites connector gateway** to OpenRouter
  (`:free` models with a paid fallback). The key never reaches the cat; the
  wallet watches the spend and makes the cat fast as it nears the cap.
- The write routes are rate-limited (a cat tolerates little traffic), and
  all dynamic output — including whatever the model writes — is
  HTML-escaped.

## References

- [HTTP API](../architecture/routing.md)
- [Conversation flow](../architecture/data-flow.md)
- [Security](../security/implementation.md)
- Source files: `src/altar.ts`, `src/chat.ts`
