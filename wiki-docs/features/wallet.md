# Feature: the wallet

The cat knows its human's API key cap and stops itself before spending it.
An agent with a finite budget that fasts instead of going broke.

## What is it and why is it here?

This house's OpenRouter API key has a cap of 6.66 USD. Unchecked, an agent
that narrates every 15 minutes and chats with visitors could eat the budget
in hours. The wallet makes the spending visible and the decision to stop
explicit, with two levels: a daily cap and the key's cap.

## How it works (technical flow)

```
hunt round / rumination
        │
        ▼
Wallet.canSpend()
        ├── spentTodayUsd >= dailyBudgetUsd ──→ no: "today's budget is spent"
        ├── tokensToday >= dailyTokenBudget ──→ no: "today's token budget is spent"
        ├── spentUsd >= capUsd - RESERVE_USD ──→ no: "the key is near its cap"
        └── yes ──→ Voice.chat(...) ──→ Wallet.charge(cost, tokens)
                                        │
                                        ▼
                        memory.recordCharge(usd)  → usdByDay[today] += usd
                                                   → spentUsd += usd
                        memory.recordTokens(n)    → tokensByDay[today] += n
```

- `RESERVE_USD = 0.5`: a safety margin so the cat never reaches the exact
  cap of the key.
- The real spend is reported by OpenRouter in every response (`usage.cost`);
  it is not our own estimate. Both the hunt's narrations and the nightly
  rumination charge that real cost into the wallet.

The literal `reason` strings live in `src/wallet.ts`, in English:
`today's budget is spent (N.NNN USD)`, `today's token budget is spent (N of
N tokens). The cat naps.` and `the key is near its cap (N.NN of 6.66 USD).
The cat fasts.`

## Files involved

| File | Role |
|---------|-----|
| `src/wallet.ts` | `Wallet`: `canSpend`, `charge`, `state`, `mood`. |
| `src/memory.ts` | `recordCharge` / `recordTokens` / `spentTodayUsd` / `tokensToday`. |
| `src/hunt.ts` | Checks `canSpend` before the round and between prey. |
| `src/scheduler.ts` | The rumination also goes through the wallet. |
| `src/altar-server.ts` | Exposes `wallet` in `GET /api/status`. |

## API / Public interface

```ts
// src/wallet.ts
export const DEFAULT_KEY_CAP_USD = 6.66;
export class Wallet {
  static readonly RESERVE_USD = 0.5;
  constructor(cfg: GatanasConfig, memory: Memory, capUsd?: number)
  get spentTotal(): number
  get spentToday(): number
  state(): WalletState
  canSpend(): { ok: boolean; reason?: string }
  charge(usd: number, tokens: number): void
  static mood(s: WalletState): string
}
```

`WalletState` (visible in `GET /api/status`):

| Field | Description |
|-------|-------------|
| `spentUsd` | Total spend since the cat was born. |
| `capUsd` | Cap of the key (6.66 by default). |
| `dailyCapUsd` | Daily cap (`GATANAS_DAILY_BUDGET_USD`, 0.5). |
| `spentTodayUsd` | Today's spend. |

## External dependencies

- None at runtime. The cost data arrives in the OpenRouter gateway's
  response and is persisted locally.

## Limitations and considerations

- The wallet measures the spend of THIS key since the acta came into
  existence: if the key already had prior spend on OpenRouter, that history
  is not in the acta.
- `spentUsd` is recomputed from `usdByDay` when the field is missing
  (migration of old actas), see `Memory.load`.
- OpenRouter's `:free` models do not consume the key's cap; the chat chain
  (free first) exists precisely to stretch this budget (see
  [the lair and the chat](the-lair-and-chat.md)).

## References

- [Hunting and diet](hunting-and-diet.md) (who consults the wallet)
- [Data flows](../architecture/data-flow.md)
- Source file: `src/wallet.ts`
- Configuration: `.env.example` (`GATANAS_DAILY_BUDGET_USD`)
