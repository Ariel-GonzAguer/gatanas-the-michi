# Feature: the nine lives

The cat's lives are real Sprite checkpoints: dying means restoring a
checkpoint, and the acta survives its own deaths.

## What is it and why is it here?

A Sprite can take checkpoints and restore them. Restoring rewinds the entire
disk, including `memory.json` — the cat's acta. That is the non-trivial
problem: a cat that dies cannot forget that it died. `NineLives` solves the
sequence: it writes everything down BEFORE restoring, and AFTER it reconciles
the rewound acta with what had been written.

## How it works (technical flow)

```
POST /api/revive {"reason"}   or   cli revive
        │
        ▼
livesRemaining > 0 and api.canManage ──no──→ null (no one dies who cannot come back)
        │
        ▼
spendLife(reason)
        │
        ├── 1. event "restored" to the acta + lives-1 (saved BEFORE)
        ├── 2. snapshot of checkpoints in memory
        ├── 3. api.restoreCheckpoint(id)
        │        └── error ──→ life returned + event removed (throw)
        └── 4. reconciliation: checkpoints restored,
                 and if the disk brought an old acta, the event is re-registered
```

- `takeCheckpoint(comment)` creates the checkpoint through the control plane
  and stores a `CheckpointRef` in the acta (cap of 20 references).
- `loseLife(reason)` is death by accident (knocking something off the
  table): it consumes a life without restoring anything.
- `reincarnate(reason)` gives back the full `cfg.lives` lives without wiping
  the lair's gifts.
- After a recent restoration, the `Scheduler` enters a "reviving" window
  (20 s) in which it neither hunts nor converses, and the lair draws the cat
  in a trance.

## Files involved

| File | Role |
|---------|-----|
| `src/lives.ts` | `NineLives`: `takeCheckpoint`, `spendLife`, `loseLife`, `reincarnate`, `narrative(event)`. |
| `src/habitat.ts` | `SpritesApi.createCheckpoint` / `restoreCheckpoint` (control plane, `SPRITES_TOKEN`). |
| `src/memory.ts` | `checkpoints: CheckpointRef[]`, `lifeEvents: LifeEvent[]`, `livesRemaining`. |
| `src/scheduler.ts` | Revive window when waking up from a restoration. |
| `src/altar-server.ts` | `POST /api/revive` (alias `/api/nahualada`), `GET /api/lives`. |
| `src/cli.ts` | `node dist/cli.js revive` / `lives`. |

## API / Public interface

```ts
// src/lives.ts
export class NineLives {
  constructor(cfg: GatanasConfig, memory: Memory, api: SpritesApi | null)
  get state(): LifeState
  async takeCheckpoint(comment: string): Promise<CheckpointRef | null>
  async prepareLife(reason: string): Promise<CheckpointRef | null>
  async spendLife(reason: string, checkpointId?: string): Promise<LifeEvent | null>
  async loseLife(reason: string): Promise<LifeEvent | null>
  async reincarnate(reason: string): Promise<LifeEvent>
  static narrative(e: LifeEvent): string
}
export function fakeSpritesApi(opts?: { fail?: boolean }): SpritesApi  // for tests
```

| Method | Returns `null` when |
|--------|------------------------|
| `spendLife` | no lives remain, or there is no control-plane key |
| `takeCheckpoint` | there is no key, or the control plane failed |

`LifeState` exposed by `GET /api/lives`: `livesRemaining`, `lives`,
`lastCheckpoint`, `events`.

## External dependencies

- Sprites control plane (`SPRITES_TOKEN`): `POST /v1/sprites/<n>/checkpoints`
  and `/restore`. Without a token the feature stays inert but the rest of
  the agent works normally.

## Limitations and considerations

- The restoration rewinds the ENTIRE disk, not just the acta: any file not
  covered by the checkpoint is lost. That is why the flow saves the event
  before restoring.
- The life counter is honest, not decorative: a `spendLife` that fails at
  the restoration gives the life back (rule covered by a test).
- Sprite checkpoints consume disk space; `takeCheckpoint` keeps at most 20
  references in the acta, but the actual checkpoints pile up in the control
  plane.

## References

- [General architecture](../architecture/overview.md)
- [Deployment on Sprites](../deployment/platform.md)
- [Testing](../development/testing.md) (`test/lives.test.ts` covers the full pact)
- Source file: `src/lives.ts`
