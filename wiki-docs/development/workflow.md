# Workflow de desarrollo

Cómo se compila, prueba, corre y publica el agente. Todo con la librería
estándar y `tsc`: no hay bundler, ni docker, ni CI externa.

## 1. Resumen

Flujo diario: editar `src/*.ts` → `npm run build` → `npm test` →
`scripts/deploy.sh` (sube al Sprite) → `github-publish.js` desde el Sprite
(publica el repo). Local sirve para desarrollo; el Sprite es el entorno
real.

## 2. Scripts de `package.json`

| Script | Comando | Cuándo ejecutarlo |
|--------|---------|-------------------|
| `build` | `tsc -p tsconfig.json && tsc -p tsconfig.test.json` | Después de editar `src/`. |
| `start` | `node dist/main.js` | Correr el servidor compilado local. |
| `dev` | `node --experimental-strip-types src/main.ts` | Correr sin compilar (Node ≥ 22.6). |
| `test` | `tsc -p tsconfig.test.json && node --test dist-test/test/*.test.js` | Antes de cada deploy. |
| `hunt` | `node dist/cli.js hunt` | Una cacería manual. |
| `altar` | `node dist/cli.js altar` | Resumen del acta en terminal. |
| `lives` | `node dist/cli.js lives` | Vidas y checkpoints. |
| `meow` | `node dist/cli.js meow` | Hablarle al gato desde terminal. |
| `revive` | `node dist/cli.js revive` | Tirarse de la mesa y revivir (alias CLI: `nahualada`). |

Para desarrollo local sin tocar el acta real:

```bash
GATANAS_HOME=/tmp/gato PORT=8099 GATANAS_HUNT_INTERVAL_SEC=0 npm start
```

## 3. Compilación y estilo

- ESM estricto: `"type": "module"`, imports relativos con extensión `.js`,
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
- `engines.node >= 22.6` (por `--experimental-strip-types` en `dev`).
- Sin linter configurado: el estilo lo fija el propio código (secciones de
  comentario-encabezado por módulo, tipos explícitos en firmas públicas).

## 4. Publicación del repo

El repo público NO se empuja con `git push`: se publica desde dentro del
Sprite con `src/github-publish.ts` (Git Data API por el conector OAuth).
Flujo completo en [auto-publicación](../features/auto-publicacion-github.md).
El directorio local `/data/workspace/gatanas` es el espejo de edición; la
fuente de verdad publicada es el árbol de trabajo del Sprite.

## 5. En la terminal del Sprite

`scripts/sprite-shims.sh` (invocado por el deploy) instala los comandos del
gato a secas en el PATH del Sprite: `gatanas`, `hunt`, `altar`, `lives`,
`meow`, `revive` (alias `nahualada`). Desde `sprite console` no hace falta
ni `cd` ni `node dist/cli.js`.

### Desde tu máquina: el CLI `sprite`

Fuera del Sprite, el CLI oficial habla con el plano de control:

```bash
sprite console -s gatanas-the-michi         # shell interactiva dentro del Sprite
sprite exec -s gatanas-the-michi --no-stdin -- altar   # un comando, imprime y sale
sprite exec -s gatanas-the-michi --tty -- bash         # TTY desmontable (Ctrl+\ suelta sin matar)
sprite info -s gatanas-the-michi            # estado, URL, etiquetas
sprite proxy 8080 -s gatanas-the-michi      # el altar en http://localhost:8080
```

Un Sprite frío se despierta solo con el primer `exec`, `console` o request
HTTP; el servicio del gato arranca al despertar, sin intervención.

### El detalle del `--`

Todo lo que va después de `--` es el comando remoto, **en la misma línea**.
Si el paste parte la línea en dos, bash corre dos cosas: `sprite exec … --`
(sin comando → `Error: command required`) y después el resto **en tu máquina
local**. El síntoma típico es un `Permission denied` sobre
`/tmp/systemd-private-*`, un directorio de systemd que solo existe en la VM
local. Formas seguras:

```bash
# una sola línea:
sprite exec -s gatanas-the-michi --no-stdin -- find /tmp -type f -mtime +1 -print -delete

# continuación explícita (el \ pegado al final de la línea):
sprite exec -s gatanas-the-michi --no-stdin -- \
  find /tmp -type f -mtime +1 -print -delete

# comando remoto complejo (pipes, &&): envuelto en bash -c
sprite exec -s gatanas-the-michi --no-stdin -- bash -c 'altar && meow "prrrr"'
```

Regla práctica: el prompt delata dónde corrés — `arieg@instabox-…` es tu
máquina; `sprite@gatanas-the-michi` es el Sprite.

### Receta verificada: limpiar `/tmp` del Sprite

```bash
find /tmp -type f -mtime +1 -print -delete
```

Es seguro en este Sprite: `-type f` no toca directorios ni symlinks, corre
como el usuario `sprite` (lo de root da Permission denied y sigue), el acta
vive en `~/.gatanas` y el código en `~/gatanas-the-michi` — nada valioso en
`/tmp` — y el `node-compile-cache` de Node se regenera solo. Dos matices:
`-mtime +1` borra lo que tiene **2 días o más** (para "más de 24 h" exacto,
`-mmin +1440`), y conviene correr primero la versión sin `-delete` para ver
qué tocaría.

## 6. Smoke manual tras un deploy

1. `GET /api/status` → 200 y `alive: true`.
2. `POST /api/purr` → contador incrementa.
3. `POST /api/chat` con un mensaje → respuesta con el carácter del gato
   (no el fallback de cansancio).
4. `POST /api/hunt` → `ran: true` con las presas del momento.
5. `tail /.sprite/logs/services/gatanas.log` dentro del Sprite para
   confirmar el pulso.

## 7. Problemas comunes

Cualquier comportamiento raro del modelo o del Sprite: la primera parada es
[troubleshooting](../deployment/troubleshooting.md), que lista los
incidentes reales conocidos con causa y solución.

## Referencias

- [Testing](testing.md)
- [Deployment en Sprites](../deployment/platform.md)
- [Auto-publicación](../features/auto-publicacion-github.md)
- CLI de Sprites: `sprite --help` (console, exec, proxy, info)
- Scripts reales: `package.json`, `scripts/deploy.sh`
