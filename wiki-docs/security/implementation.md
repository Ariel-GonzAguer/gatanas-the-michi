# Security — implementation

The agent runs exposed on a public URL and talks to two connectors that
hold other parties' secrets. The implementation minimizes surface: zero
dependencies, zero CDNs, secrets outside the process.

## 1. Summary

Three fronts: the HTTP perimeter (headers, rate limiters, escaping), the
chat surface (what the model can do), and credential custody (BYOK via
connectors, optional `SPRITES_TOKEN`).

## 2. HTTP perimeter

| Control | Implementation | Location |
|---------|----------------|-----------|
| Strict CSP | `default-src 'none'` + inline allowed only for what the page uses | `SECURITY_HEADERS` in `altar-server.ts` |
| Anti-clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | same |
| Anti-MIME | `X-Content-Type-Options: nosniff` | same |
| Referrer | `Referrer-Policy: no-referrer` | same |
| Rate limiting | 60 s window per route (chat 20, purr 30, churus 30, hunt 3, revive 3) | `limiter()` |
| Body limit | 64 KiB on POST; exceeding it cuts the connection | `readBody()` |
| Model input | message trimmed to 1200 chars | `speak()` / handler |
| Robots | `Disallow: /api/` | `GET /robots.txt` |

Output escaping: ALL dynamic text in the HTML (the model's narrations, prey
titles, the opinion) goes through `esc()` in `altar.ts`. `test/altar.test.ts`
injects `<script>alert(1)</script>` and `<img src=x onerror=...>` as a
narration and verifies they reach the HTML escaped. The page's JS uses
`textContent` (never `innerHTML`) to paint the chat thread.

## 3. Credential custody

```
┌────────────┐  Sprite identity        ┌──────────────────────┐
│  Process   │────────────────────────→│  Sprites gateway     │
│  (cat)     │   never sees the key    │  - OpenRouter (BYOK) │
└────────────┘                         │  - GitHub (OAuth)    │
                                       └──────────────────────┘
```

- The OpenRouter API key lives in the gateway connector: the process uses
  it indirectly and never reads it. `access_policy.sprite_labels`
  restricts each connector to Sprites with the `gatanas` label.
- The GitHub OAuth token stays on the gateway side; the cat makes signed
  calls without possessing it (see
  [self-publishing](../features/auto-publicacion-github.md)).
- `SPRITES_TOKEN` (control plane: checkpoints, services, exec) is
  optional and only passed as a service environment variable. Without it,
  the agent loses lives and restarts, not observability or the lair.

## 4. What the model can and cannot do

| Risk | Mitigation |
|--------|------------|
| Inflating the severity of findings | Classification is pure heuristic (`diet.ts`); the model only words the prose |
| Injecting HTML through a narration | `esc()` + injection test + `textContent` on the client |
| Prompt injection from chat | The message travels as data of a single turn; there are no tools and no actions executed from chat |
| Runaway spend | Wallet with a daily cap and a key cap (see [the wallet](../features/monedero.md)) |
| DoS via tokens | Per-route rate limiters + `GATANAS_DAILY_TOKEN_BUDGET` |

The cat doesn't execute actions requested by chat: no tools, no shell from
conversation. Restarting services or dying requires the dedicated routes,
which are rate-limited and (in the lives case) protected by
`SPRITES_TOKEN`.

## 5. Common problems

- The Sprite's public URL was set to `auth: public` so the lair is visible
  during the demo: it's a conscious decision of this project, not an
  oversight. To restrict it, change `url_settings.auth` in the
  control plane.
- The exec of the Sprites API (used by `scripts/deploy.sh`) requires the
  control-plane token: it never goes into the repo or the Sprite.

## References

- [HTTP API](../architecture/routing.md) (headers and per-route rate limiters)
- [The lair and chat](../features/altar-y-chat.md) (chat-thread escaping)
- [Self-publishing](../features/auto-publicacion-github.md)
- Source files: `src/altar-server.ts`, `src/altar.ts`
