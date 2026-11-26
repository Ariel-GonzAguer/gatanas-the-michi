# Despliegue — plataforma Fly.io Sprites

El agente corre como servicio de un Sprite de Fly.io: una máquina con disco
persistente, URL pública HTTPS y API de plano de control para operarla.

## 1. Resumen

Sprite `gatanas-the-michi` (8 vCPU, Node 24, usuario `sprite`). El proceso
`node dist/main.js` corre como servicio gestionado por `sprite-env`, escucha
en 8080 y el proxy del Sprite publica esa puerta como URL HTTPS pública.

```
┌──────────────────┐        ┌────────────────────────────────┐
│  Internet         │──────→ │  Proxy del Sprite (HTTPS)      │
│  (visitantes)     │        │  gatanas-the-michi-….sprites.app│
└──────────────────┘        └──────────────┬─────────────────┘
                                           │ :8080
┌──────────────────────────────────────────▼─────────────────┐
│  Servicio "gatanas" (sprite-env)                            │
│  node dist/main.js  ·  GATANAS_HOME=/home/sprite/.gatanas   │
│  acta: /home/sprite/.gatanas/memory.json (disco persistente)│
└─────────────────────────────────────────────────────────────┘
        │                                   │
        ▼                                   ▼
gateway de conectores               plano de control
(OpenRouter, GitHub)                (checkpoints, servicios, exec)
```

## 2. El deploy (`scripts/deploy.sh`)

Flujo del script, que opera desde afuera con `SPRITES_TOKEN`:

| Paso | Qué hace |
|------|----------|
| 1 | `tsc -p tsconfig.json` (compila a `dist/`). |
| 2 | `tar czf` de `dist/` + metadatos → base64. |
| 3 | `exec` del plano de control: `mkdir -p /home/sprite/gatanas-the-michi`. |
| 4 | Sube el tarball por stdin del exec (`&stdin=true`) y descomprime en el Sprite. |
| 5 | Recrea el servicio: `sprite-env services create gatanas --cmd node --args dist/main.js --dir … --env … --http-port 8080`. |

Sin `npm install`: el proyecto no tiene dependencias de runtime.

## 3. Variables de entorno del servicio

| Variable | Valor en producción | Origen |
|----------|---------------------|--------|
| `PORT` | `8080` | deploy.sh |
| `SPRITE_NAME` | `gatanas-the-michi` | deploy.sh |
| `GATANAS_HOME` | `/home/sprite/.gatanas` | deploy.sh |
| `OPENROUTER_CONNECTION` | default en `config.ts` | `src/config.ts` |
| `SPRITES_TOKEN` | (no se configura por defecto) | opcional, solo vidas/servicios |

El resto de defaults vive en `src/config.ts` (intervalo de caza 900 s,
presupuesto diario 0.5 USD, 9 vidas) y se sobreescribe con `--env` del
servicio si hace falta.

## 4. Persistencia y operación

- **Acta**: `/home/sprite/.gatanas/memory.json` sobrevive a reinicios del
  servicio y a sueños del Sprite (disco persistente).
- **Logs**: `/.sprite/logs/services/gatanas.log` (el propio servicio escribe
  ahí; para otros procesos la carpeta es de solo lectura).
- **URL pública**: `url_settings.auth: public` (decisión de demo).
- **Checkpoints**: por el plano de control; son la base de las
  [nueve vidas](../features/nueve-vidas.md).
- **Estado del servicio**: `sprite-env services list` dentro del Sprite, o
  `GET /api/status` desde afuera.

## 5. Problemas comunes

Ver [troubleshooting](troubleshooting.md): respuestas vacías del modelo,
429 de modelos free, 502 del proxy, operaciones sobre el acta, repo vacío.

## Referencias

- [Auto-publicación del repo](../features/auto-publicacion-github.md)
- [Nueve vidas](../features/nueve-vidas.md) (checkpoints)
- Script: `scripts/deploy.sh`
- Variables completas: `.env.example`
