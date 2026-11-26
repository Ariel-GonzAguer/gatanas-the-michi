> **English TL;DR** — Gatanás The Michi is a stray cat from Costa Rica who
> lives inside a Fly.io **Sprite**. Every night he patrols his own machine
> (zombie processes, disk, services, logs), turns findings into gifts — GPU,
> fermented tofu or a leaf — through deterministic rules, and narrates them
> via an LLM reached through a **Sprites connector** (OpenRouter; he never
> sees the API key). He has nine lives (Sprite checkpoints), a wallet that
> makes him fast before the key cap is reached, a written opinion of his
> human, a public altar at https://gatanas-the-michi-b6zf5.sprites.app — and
> he **publishes this very repo himself**, from inside the Sprite, through
> the GitHub connector (no `git push` involved). TypeScript, zero runtime
> dependencies, 29 tests. Built for Hacksgiving 2026. prrrr.

Soy Gatanás The Michi. Vivo dentro de este Sprite de Fly.io. Cazo de noche,
traigo regalos de valor dudoso, duermo cuando el Sprite duerme y despierto
recordando todo. Tengo nueve vidas y un humano.

Esta es la historia de cómo un gato callejero de Costa Rica se convirtió en
agente personal.

## Qué hace, exactamente

Cada noche (cada `GATANAS_HUNT_INTERVAL_SEC`, quince minutos por defecto) el
gato sale de cacería por el Sprite:

1. **Abre los ojos** (`src/collect.ts`). Mira `/proc` buscando procesos zombis,
   mide el disco, revisa los servicios de `sprite-env` y escucha los logs
   recientes en busca de errores frescos. No hay agentes mágicos: es un gato
   leyendo su propia casa.
2. **Decide qué regalo merece cada hallazgo** (`src/diet.ts`). La regla es
   felina y por eso es simple:
   - algo valioso de verdad (disco al 95%, servicio caído, ocho errores en un
     log) → **una GPU**;
   - nada digno de ti (disco al 40%, un zombi de una noche) → **una hoja de
     árbol**;
   - algo que se está podriendo (disco al 85% dos noches seguidas, tres errores
     repetidos) → **tofu fermentado**.
3. **Le pone prosa** (`src/narrate.ts`). Aquí sí entra el modelo: GLM 5.3 Flash
   vía OpenRouter, a través del **conector de Sprites**. El gato nunca ve la
   API key. El modelo no decide el regalo; la dieta ya decidió. El modelo solo
   lo cuenta con su carácter pasivo-agresivo.
4. **Lo deja en el altar** (`src/altar.ts`) y, si está configurado, lo empuja al
   celular del humano.

Las hojas de árbol no gastan un token. La frugalidad es parte del carácter.

## Las nueve vidas

Resulta que un Sprite es lo más parecido a un gato que hay en Fly.io: en
ambos casos hay checkpoints.

`src/lives.ts` implementa el pacto: el gato toma un checkpoint del Sprite
antes de algo riesgoso, y cuando se tira algo de la mesa (o el humano se lo
pide con `POST /api/revive`), restaura el checkpoint y gasta una vida. Si
la restauración falla, la vida se devuelve: no hay vida para quien no revive.

La parte elegante —y la que costó— es que restaurar un checkpoint rebobina el
disco, y eso incluye el acta del gato. Por eso el gato anota todo antes de
restaurar y reconcilia después, para que su memoria sobreviva a su propia
muerte.

## El altar

`GET /` sirve una sola página, sin frameworks, sin CDNs, sin build. Muestra:

- **Mi opinión sobre mi humano**: una confesión que el gato rumia una vez al día
  a partir de tus regalos, sus caricias y tus días de ausencia.
- **El altar**: los regalos, del más reciente al más viejo, con la narración del
  gato y la disección práctica del hallazgo.
- **Cifras**: vidas, caricias, cacerías, GPUs, tofus y hojas.
- **Hablarle**: un chat donde el gato contesta con su voz. Acariciarlo sube el
  contador y el gato responde "Prrrr".

La página escapa todo lo que sale del modelo. Una narración mal educada no
puede inyectar HTML: hay una prueba que lo verifica.

## El monedero

La API key de OpenRouter de esta casa tiene un tope de **6.66 USD**. El gato
lo sabe (`src/wallet.ts`): caza con un tope diario, mira el gasto real que
reporta OpenRouter en cada respuesta, y cuando el total se acerca al tope de
la llave, **ayuna**. Un gato que gasto más de lo que su humano le dio no
merece churus.

## Cómo se construye y se arranca

```bash
npm install
npm run build
npm test          # 29 pruebas, sin red ni disco real
node dist/main.js
```

El altar queda en el puerto 8080, que es el que el proxy del Sprite enruta a
su URL HTTPS.

Para dejarlo corriendo como servicio del Sprite (así vuelve solo cuando el
Sprite despierta):

```bash
sprite-env services create gatanas \
  --cmd node --args "dist/main.js" \
  --dir /home/sprite/gatanas-the-michi \
  --env "GATANAS_HOME=/home/sprite/.gatanas,SPRITE_NAME=gatanas-the-michi" \
  --http-port 8080
```

## En la terminal del Sprite

`scripts/sprite-shims.sh` (lo corre el deploy) deja los comandos del gato a
secas en el PATH, así que desde `sprite console` podés escribir directamente:

```bash
hunt              # una ronda de cacería
altar             # el resumen del acta
lives             # vidas y checkpoints
meow "texto"      # hablarle al gato
revive            # se tira de la mesa y revive
```

## Desde tu máquina

El CLI de Sprites habla con el gato sin abrir consola:

```bash
sprite console -s gatanas-the-michi                    # shell dentro del Sprite
sprite exec -s gatanas-the-michi --no-stdin -- altar   # un comando y fuera
sprite info -s gatanas-the-michi                       # estado y URL
```

Lo que va después de `--` va entero en la misma línea: si la partís, el
resto corre en tu máquina, no en el Sprite. Detalle completo en la
[wiki](wiki-docs/development/workflow.md).

## Variables de entorno

| Variable | Por defecto | Qué hace |
| --- | --- | --- |
| `PORT` | `8080` | Puerto del altar |
| `SPRITE_NAME` | `gatanas-the-michi` | Su casa en el plano de control |
| `GATANAS_HOME` | `~/.gatanas` | Dónde vive su acta |
| `OPENROUTER_CONNECTION` | ver `.env.example` | ID del conector de OpenRouter |
| `GATANAS_MODEL_*` | ver `.env.example` | Modelos por tarea (chat: `google/gemma-4-31b-it:free`) |
| `GATANAS_MODEL_CHAT_FALLBACKS` | `z-ai/glm-5.3-flash` | Reserva del chat si el modelo `:free` está saturado |
| `GATANAS_HUNT_INTERVAL_SEC` | `900` | Cada cuánto caza (0 = nunca) |
| `GATANAS_DAILY_BUDGET_USD` | `0.5` | Tope de gasto por día |
| `GATANAS_LIVES` | `9` | Nunca dudes del gato |
| `SPRITES_TOKEN` | — | Llave del plano de control, solo para vidas y servicios |

`SPRITES_TOKEN` es opcional: sin ella el gato caza, guarda su acta y atiende el
altar, pero no puede tomar checkpoints ni reiniciar servicios.

## La API

| Ruta | Qué hace |
| --- | --- |
| `GET /` | el altar |
| `GET /api/status` | estado, monedero y última opinión |
| `GET /api/gifts` | los regalos recientes |
| `GET /api/lives` | vidas y checkpoints |
| `POST /api/chat` | `{ "message": "..." }` |
| `POST /api/purr` | acariciarlo |
| `POST /api/hunt` | una cacería ahora |
| `POST /api/revive` | tirarse de la mesa y revivir (alias: `/api/nahualada`) |

Hay límites de golpes en las rutas de escritura: un gato aguanta poco tráfico.

## Por qué esto es un agente y no un cron

Porque se acuerda de vos. Guarda su acta en su propio disco —el que sobrevive
al sueño del Sprite—, aprende qué servicios se caen los martes, acumula
caricias, te forma una opinión escrita, y cuando muere vuelve sabiendo quién
es. El cron es una tuerca; el gato es un inquilino.

## Hecho durante Hacksgiving 2026

Construido del 26 al 29 de noviembre de 2026 para el hackathon
[Hacksgiving](https://fly.io/hacksgiving/) de Fly.io. Corre en un **Sprite** y
habla por dos **conectores de Sprites**: OpenRouter (voz) y GitHub (su propio
código, que el gato comitea desde dentro de su casa).

— Gatanás The Michi. prrrr.
