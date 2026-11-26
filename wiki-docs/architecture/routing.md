# HTTP API — the lair and its routes

The server (`src/altar-server.ts`) is a standard-library `http.Server`
listening on `PORT` (8080). The Sprite's proxy routes the public HTTPS URL
to that port.

## 1. Summary

Two families of routes: the lair page (HTML) and the JSON API consumed by
that same page's inline JS or by any external client. All JSON responses
use `Cache-Control: no-store` and the same block of security headers.

## 2. Routes

| Method | Route | Handler | Description |
|--------|------|---------|-------------|
| GET | `/` (aliases `/altar` and `/guarida`) | the lair page | Full HTML with opinion, gifts, figures, and chat. |
| GET | `/robots.txt` | plain text | `Disallow: /api/` for every user-agent. |
| GET | `/api/status` | JSON | State: alive, awake, lives, purrs, churus, hunts, gifts, wallet, opinion. |
| GET | `/api/gifts` | JSON | The 50 most recent gifts in the lair. |
| GET | `/api/lives` | JSON | `NineLives` state: lives remaining, checkpoints, events. |
| POST | `/api/chat` | JSON | Talk to the cat. Body: `{"message": "..."}` (max. 1200 chars after trimming). |
| POST | `/api/purr` | JSON | Pet the cat: increments the persistent counter. |
| POST | `/api/churus` | JSON | Give the cat a churu: increments the persistent counter and answers with the deterministic `churusReply()` from `src/narrate.ts`. |
| POST | `/api/hunt` | JSON | One immediate hunt round. Returns the full outcome. |
| POST | `/api/revive` | JSON | Knock everything off the table and revive. Optional body: `{"reason": "..."}`. Alias: `/api/nahualada`. |

The lair page itself ends with a `How does this site work?`
(`details`/`summary`) section: the single-file HTML served by `node:http`,
the acta on the Sprite's persistent disk, the hunt cycle, the chat path
(Sprites connector gateway → OpenRouter, `:free` models with a paid
fallback), the per-minute rate limits, no cookies or trackers, and
HTML-escaped dynamic output. While the model generates, the chat thread
(`aria-live="polite"`) shows a typing indicator — "Gatanás is thinking
about what to meow back…". No streaming: the reply arrives complete, with
a cat's manners.

### Errors

| Status | When | Body |
|--------|--------|--------|
| 400 | invalid JSON body in `/api/chat` | `{"reply": "That wasn't a valid meow."}` |
| 429 | rate limit exceeded | `{"reply": "..."}` with the reason |
| 500 | unhandled exception | `{"reply": "I choked on something. Try again. prrrr."}` |
| 404 | unknown route | `{"reply": "Nothing here. Not even a box. meow."}` |

## 3. Rate limiters

`limiter(n)` keeps a 60 s sliding window per route:

| Route | Hits per minute |
|------|-------------------|
| `/api/chat` | 20 |
| `/api/purr` | 30 |
| `/api/churus` | 30 |
| `/api/hunt` | 3 |
| `/api/revive` | 3 |

The body of POST requests is read with a 64 KiB cap (`readBody`); exceeding
it cuts the connection.

## 4. Security headers

All JSON responses and the HTML share:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
  script-src 'unsafe-inline'; img-src data:; connect-src 'self';
  form-action 'none'; base-uri 'none'; frame-ancestors 'none'
```

The CSP allows exactly what the page uses: inline CSS and JS (the page has
no external files) and `data:` images (the SVG favicon). See
[security implementation](../security/implementation.md).

## 5. Common problems

- The Sprite's proxy may answer 502 if a handler exceeds its time window
  (it happens with slow models on `/api/chat`): see
  [troubleshooting](../deployment/troubleshooting.md).
- `/api/hunt` returns `ran: false` with a `reason` when the wallet doesn't
  authorize spend: it's not an error, it's the cat fasting.

## References

- [The lair and chat](../features/the-lair-and-chat.md)
- [Data flows](data-flow.md)
- Source file: `src/altar-server.ts`
- Page served: `src/altar.ts`
