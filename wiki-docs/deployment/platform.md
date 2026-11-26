# Deployment — the Fly.io Sprites platform

The agent runs as a service of a Fly.io Sprite: a machine with persistent
disk, a public HTTPS URL, and a control-plane API to operate it.

## 1. Summary

Sprite `gatanas-the-michi` (8 vCPU, Node 24, user `sprite`). The process
`node dist/main.js` runs as a service managed by `sprite-env`, listens on
8080, and the Sprite's proxy exposes that port as a public HTTPS URL.

```
┌──────────────────┐        ┌────────────────────────────────┐
│  Internet         │──────→ │  Sprite proxy (HTTPS)          │
│  (visitors)       │        │  gatanas-the-michi-….sprites.app│
└──────────────────┘        └──────────────┬─────────────────┘
                                           │ :8080
┌──────────────────────────────────────────▼─────────────────┐
│  Service "gatanas" (sprite-env)                             │
│  node dist/main.js  ·  GATANAS_HOME=/home/sprite/.gatanas   │
│  acta: /home/sprite/.gatanas/memory.json (persistent disk)  │
└─────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
connector gateway                   control plane
(OpenRouter, GitHub)                (checkpoints, services, exec)
```

## 2. The deploy (`scripts/deploy.sh`)

The script's flow, operating from the outside with `SPRITES_TOKEN`:

| Step | What it does |
|------|----------|
| 1 | `tsc -p tsconfig.json` (compiles to `dist/`). |
| 2 | `tar czf` of `dist/` + metadata → base64. |
| 3 | Control-plane `exec`: `mkdir -p /home/sprite/gatanas-the-michi`. |
| 4 | Uploads the tarball through the exec's stdin (`&stdin=true`) and unpacks it on the Sprite. |
| 5 | Recreates the service: `sprite-env services create gatanas --cmd node --args dist/main.js --dir … --env … --http-port 8080`. |

No `npm install`: the project has no runtime dependencies.

## 3. Service environment variables

| Variable | Value in production | Origin |
|----------|---------------------|--------|
| `PORT` | `8080` | deploy.sh |
| `SPRITE_NAME` | `gatanas-the-michi` | deploy.sh |
| `GATANAS_HOME` | `/home/sprite/.gatanas` | deploy.sh |
| `OPENROUTER_CONNECTION` | default in `config.ts` | `src/config.ts` |
| `SPRITES_TOKEN` | (not set by default) | optional, only lives/services |

The rest of the defaults live in `src/config.ts` (hunt interval 900 s,
daily budget 0.5 USD, 9 lives) and are overridden with the service's
`--env` if needed.

## 4. Persistence and operation

- **Acta**: `/home/sprite/.gatanas/memory.json` survives service restarts
  and the Sprite's sleeps (persistent disk).
- **Logs**: `/.sprite/logs/services/gatanas.log` (the service itself writes
  there; for other processes the folder is read-only).
- **Public URL**: `url_settings.auth: public` (a demo decision).
- **Checkpoints**: through the control plane; they are the basis of the
  [nine lives](../features/nueve-vidas.md).
- **Service state**: `sprite-env services list` inside the Sprite, or
  `GET /api/status` from outside.

## 5. Common problems

See [troubleshooting](troubleshooting.md): empty replies from the model,
429s from free models, 502s from the proxy, acta operations, an empty repo.

## References

- [Repo self-publishing](../features/auto-publicacion-github.md)
- [Nine lives](../features/nueve-vidas.md) (checkpoints)
- Script: `scripts/deploy.sh`
- Full variables: `.env.example`
