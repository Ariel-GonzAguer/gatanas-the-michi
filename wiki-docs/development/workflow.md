# Development workflow

How the agent is compiled, tested, run, and published. All with the
standard library and `tsc`: no bundler, no docker, no external CI.

## 1. Summary

Daily flow: edit `src/*.ts` → `npm run build` → `npm test` →
`scripts/deploy.sh` (uploads to the Sprite) → `github-publish.js` from the
Sprite (publishes the repo). Local is for development; the Sprite is the
real environment.

## 2. `package.json` scripts

| Script | Command | When to run it |
|--------|---------|-------------------|
| `build` | `tsc -p tsconfig.json && tsc -p tsconfig.test.json` | After editing `src/`. |
| `start` | `node dist/main.js` | Run the compiled server locally. |
| `dev` | `node --experimental-strip-types src/main.ts` | Run without compiling (Node ≥ 22.6). |
| `test` | `tsc -p tsconfig.test.json && node --test dist-test/test/*.test.js` | Before every deploy. |
| `hunt` | `node dist/cli.js hunt` | A manual hunt. |
| `altar` | `node dist/cli.js altar` | Summary of the acta in the terminal. |
| `lives` | `node dist/cli.js lives` | Lives and checkpoints. |
| `meow` | `node dist/cli.js meow` | Talk to the cat from the terminal. |
| `revive` | `node dist/cli.js revive` | Knock everything off the table and revive (CLI alias: `nahualada`). |

The CLI takes more orders than the npm scripts: `churus` gives the cat a
churu — when the service is up it POSTs to the local API at
`http://127.0.0.1:8080/api/churus`, so a single owner writes the acta and
the counter can't be clobbered; otherwise it writes the acta directly —
and `guarida` is an alias of the summary command (`altar` still works).
The summary line now also reports the churus count.

For local development without touching the real acta:

```bash
GATANAS_HOME=/tmp/gato PORT=8099 GATANAS_HUNT_INTERVAL_SEC=0 npm start
```

## 3. Compilation and style

- Strict ESM: `"type": "module"`, relative imports with the `.js`
  extension, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
- `engines.node >= 22.6` (for `--experimental-strip-types` in `dev`).
- No linter configured: the code itself sets the style (comment-header
  sections per module, explicit types on public signatures).

## 4. Publishing the repo

The public repo is NOT pushed with `git push`: it is published from inside
the Sprite with `src/github-publish.ts` (Git Data API through the OAuth
connector). Full flow in
[self-publishing](../features/auto-publicacion-github.md).
The local directory `/data/workspace/gatanas` is the editing mirror; the
published source of truth is the Sprite's working tree.

## 5. On the Sprite's terminal

`scripts/sprite-shims.sh` (invoked by the deploy) installs the cat's bare
commands on the Sprite's PATH: `gatanas`, `hunt`, `altar`/`guarida`,
`lives`, `meow`, `churus`, `revive` (alias `nahualada`). From
`sprite console` you don't even need `cd` or `node dist/cli.js`.

### From your machine: the `sprite` CLI

Outside the Sprite, the official CLI talks to the control plane:

```bash
sprite console -s gatanas-the-michi         # interactive shell inside the Sprite
sprite exec -s gatanas-the-michi --no-stdin -- altar   # one command, prints and exits
sprite exec -s gatanas-the-michi --tty -- bash         # detachable TTY (Ctrl+\ lets go without killing)
sprite info -s gatanas-the-michi            # state, URL, labels
sprite proxy 8080 -s gatanas-the-michi      # the lair at http://localhost:8080
```

A cold Sprite wakes up on its own with the first `exec`, `console`, or
HTTP request; the cat's service starts on wake, no intervention needed.

### The `--` detail

Everything after `--` is the remote command, **on the same line**.
If the paste splits the line in two, bash runs two things: `sprite exec … --`
(no command → `Error: command required`) and then the rest **on your local
machine**. The typical symptom is a `Permission denied` on
`/tmp/systemd-private-*`, a systemd directory that only exists on the local
VM. Safe forms:

```bash
# one single line:
sprite exec -s gatanas-the-michi --no-stdin -- find /tmp -type f -mtime +1 -print -delete

# explicit continuation (the \ glued to the end of the line):
sprite exec -s gatanas-the-michi --no-stdin -- \
  find /tmp -type f -mtime +1 -print -delete

# complex remote command (pipes, &&): wrapped in bash -c
sprite exec -s gatanas-the-michi --no-stdin -- bash -c 'altar && meow "prrrr"'
```

Rule of thumb: the prompt gives away where you're running —
`arieg@instabox-…` is your machine; `sprite@gatanas-the-michi` is the Sprite.

### Verified recipe: clean the Sprite's `/tmp`

```bash
find /tmp -type f -mtime +1 -print -delete
```

It's safe on this Sprite: `-type f` doesn't touch directories or symlinks,
it runs as the `sprite` user (root's gives Permission denied and moves on),
the acta lives in `~/.gatanas` and the code in `~/gatanas-the-michi` —
nothing valuable in `/tmp` — and Node's `node-compile-cache` regenerates
itself. Two nuances: `-mtime +1` deletes what is **2 days old or more**
(for an exact "older than 24 h", `-mmin +1440`), and it's wise to first run
the version without `-delete` to see what it would touch.

## 6. Manual smoke after a deploy

1. `GET /api/status` → 200 and `alive: true`.
2. `POST /api/purr` → counter increments.
3. `POST /api/churus` → counter increments with a deterministic reply.
4. `POST /api/chat` with a message → a reply with the cat's character
   (not the tired fallback).
5. `POST /api/hunt` → `ran: true` with the current finds.
6. `tail /.sprite/logs/services/gatanas.log` inside the Sprite to confirm
   the pulse.

## 7. Common problems

Any weird behavior from the model or the Sprite: the first stop is
[troubleshooting](../deployment/troubleshooting.md), which lists the known
real incidents with cause and solution.

## References

- [Testing](testing.md)
- [Deployment on Sprites](../deployment/platform.md)
- [Self-publishing](../features/auto-publicacion-github.md)
- Sprites CLI: `sprite --help` (console, exec, proxy, info)
- Real scripts: `package.json`, `scripts/deploy.sh`
