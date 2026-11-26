# Troubleshooting — real incidents

Entries extracted from real incidents that happened during the agent's
development and operation (2026-11-26). Each one carries the evidence that
backs it.

---

### The chat replies empty or with the tired fallback

**Symptom**: `POST /api/chat` returns the fallback reply ("I heard you,
but the words aren't coming out…") even though the gateway responds 200.

**Cause**: models that reason before writing (GLM 5.3 Flash, Nemotron with
reasoning) return `choices[0].message.content: null` with
`finish_reason: "length"` when `max_tokens` isn't enough for the internal
monologue plus the reply.

**Solution**:
1. Give `max_tokens` a fixed headroom (`REASONING_HEADROOM = 2200` in
   `src/habitat.ts`; applied always, because unused margin costs nothing).
2. Treat an empty `content` as an error (throw) so the model chain and the
   emergency repertoire come into play.

**Verification**: start a chat and check that the log has no
`the cat's voice failed: empty reply`.

**References**: `src/habitat.ts` (`chatOnce`), `src/chat.ts` (`tiredReply`).

---

### 429 upstream on the `:free` models

**Symptom**: `{"error":{"code":429,...,"is_byok":false}}` from OpenRouter
for `google/gemma-4-31b-it:free` or other `:free` models.

**Cause**: the free models run on shared upstream pools that get saturated
for stretches; the 429 is emitted by the provider, not by OpenRouter.

**Solution**:
1. Chain models for chat (`chatModelFallbacks`): free first, paid as the
   last resort (`src/config.ts`).
2. Don't retry in a loop: the chain is already the retry.

**Verification**: `GET /api/status` keeps answering 200 and the chat
replies even with the free model saturated (it draws from the paid one).

**References**: `src/habitat.ts` (`Voice.chat`), `.env.example`
(`GATANAS_MODEL_CHAT_FALLBACKS`).

---

### 502 from the Sprite proxy on `/api/chat`

**Symptom**: the public URL returns 502 with an HTML error page while the
same endpoint over localhost answers fine.

**Cause**: the proxy's time window is bounded; a slow link (e.g. a
reasoning model like `nvidia/nemotron-3.5-lightning:free`) eats the window
before the chain finishes.

**Solution**:
1. Take the slow links out of the chat chain (the chain ended up at 2:
   gemma free → glm flash).
2. Keep `GATANAS_MODEL_TIMEOUT_MS` (30000) below the proxy's window so the
   fallback link has time.

**Verification**: successive chats over the public URL answer 200 in <30 s.

**References**: `src/config.ts`, `src/habitat.ts`.

---

### Git Data API fails with 409 on a new repo

**Symptom**: `POST /repos/<repo>/git/blobs` (or `trees`, `commits`)
answers `409 {"message": "Git Repository is empty."}`.

**Cause**: the Git Data API doesn't operate on a repo without a single
commit; the repo was created empty from the web.

**Solution**:
1. Create the first file with `PUT /repos/<repo>/contents/<path>` and a
   base64 `content`: that creates the `main` branch and the initial
   commit.
2. Only after that, use the blob→tree→commit→ref flow.

**Verification**: `GET /repos/<repo>/branches` returns `main`.

**References**: `src/github-publish.ts`.

---

### Files deleted from the repo reappear in the next publish

**Symptom**: files are deleted from the repo (e.g. test probes) and
reappear after the next `github-publish.js`.

**Cause**: the script publishes the Sprite's WORKING TREE; if the file is
still in the tree, it gets uploaded again. Also, `base_tree` merges with
the remote tree: it doesn't replace.

**Solution**:
1. Delete the unwanted files from the Sprite's working tree before
   publishing.
2. Verify with `GET /repos/<repo>/contents/` after each publish.

**References**: `src/github-publish.ts` (`collectFiles`, `SKIP_*`).

---

### External edits to `memory.json` get lost

**Symptom**: the acta is edited on disk and, after restarting the service,
the edit is gone.

**Cause**: the SIGTERM handler saves the process's in-memory state over
the file, clobbering the external edit.

**Solution**:
1. `sprite-env services stop gatanas`.
2. Edit `/home/sprite/.gatanas/memory.json`.
3. `sprite-env services start gatanas`.

**Verification**: `GET /api/status` reflects the edit after startup.

**References**: `src/main.ts` (shutdown), `src/memory.ts`.

---

### Injecting the opinion as an `assistant` turn degrades the chat

**Symptom**: with the opinion persisted in the acta, the chat replies get
worse or come back empty.

**Cause**: passing the previous confession as an `role: "assistant"` turn
of the history confuses the model (it tries to "continue" its own
monologue instead of answering).

**Solution**:
1. Include the opinion as data inside the user prompt ("What you already
   think of him (don't repeat it literally, evolve it): …").

**Verification**: chats with the opinion present reply with character and
without repeating the confession verbatim.

**References**: `src/chat.ts` (`speak`).

---

### The acta's text was left with the old onomatopoeia or words

**Symptom**: old gifts in the lair show "mrrp" or "atún" after a change of
the cat's vocabulary.

**Cause**: narrations are persisted text: a persona change only affects
future generations.

**Solution**:
1. Stop the service (see the previous entry), replace in the JSON
   (`mrrp` → `prrrr`, `atún` → `churus`) in `gifts[*].narration/advice/
   huntNotes` and `opinion.quote`, and start it again.

**Verification**: `GET /api/gifts` doesn't contain the old word.

**References**: `src/narrate.ts` (`PERSONA`), `src/memory.ts`.

---

### `sprite exec` says "command required" and the command runs on your machine

**Symptom**: pasting the invocation in two lines — `sprite exec -s <sprite>
--no-stdin --` on top and the command below — produces `Error: command required`,
and then the command runs **locally**, with errors that make no sense
inside the Sprite (e.g. `find: '/tmp/systemd-private-…':
Permission denied`, a systemd directory that only exists on the machine
the call is made from).

**Cause**: the line break splits the invocation into two independent bash
commands. The first is left without a remote command; the second runs on
the local machine, not on the Sprite.

**Solution**:
1. Everything on a single line, or close the line with a `\` continuation.
2. Remote commands with pipes or `&&`: wrap them in
   `bash -c 'full command'`.

**Verification**: `sprite exec -s <sprite> --no-stdin -- hostname` returns
the Sprite's name. Prompt rule: `sprite@<sprite>` = inside;
any other user = your machine.

**References**: CLI `sprite exec --help`; [workflow §5](../development/workflow.md).
