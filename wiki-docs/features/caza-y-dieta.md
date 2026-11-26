# Feature: caza y dieta

Cada cierto tiempo el gato patrulla su propia máquina, clasifica cada
hallazgo como regalo y lo narra. Es el corazón del agente: lo demás
(altar, monedero, vidas) gira alrededor de esta cacería.

## ¿Qué es y por qué está aquí?

Un agente de monitoreo tradicional manda alertas. Gatanás caza: decide cuál
hallazgo merece atención (GPU), cuál es paja (hoja de árbol) y cuál se está
pudriendo (tofu fermentado). La clasificación es 100% heurística y
determinista; el LLM solo pone prosa. Esa separación es la decisión central
del diseño: una alucinación del modelo nunca puede inflar la severidad de un
hallazgo.

## Cómo funciona (flujo técnico)

```
cron 900s / POST /api/hunt / cli hunt
        │
        ▼
Wallet.canSpend() ──no──→ ayuna (log + reason)
        │ sí
        ▼
collectLocalPrey ──→ [disco %, /tmp MB, zombis, errores frescos]
        │
        ▼
judgeHeuristic ──null──→ chooseGift degrada a hoja
        │ veredicto
        ▼
chooseGift ──→ ajustes por rechazos previos y vidas
        │
        ├── hoja confiable ──→ fallbackNarration (0 tokens)
        └── gpu/tofu ──→ narrateGift ──→ Voice.chat("meow")
        │
        ▼
memory.addGift + giftedKeys[hoy] + memory.save
        │
        ▼
deliver (opcional, nunca rompe la caza)
```

Reglas exactas de la heurística (`src/diet.ts`):

| Categoría | Condición | Regalo | Confianza |
|-----------|-----------|--------|-----------|
| `disk` | título "disco al N%" con N ≥ 92 | GPU | 0.95 |
| `disk` | N ≥ 80 y visto 2+ noches | tofu | 0.85 |
| `disk` | N ≥ 80 primera noche | hoja | 0.85 |
| `process` | zombi con 3+ avistamientos | tofu | 0.85 |
| `process` | zombi recién nacido | hoja | 0.85 |
| `service` | "detenido" y quedan vidas | GPU | 0.90 |
| `service` | "detenido" sin vidas | tofu | 0.60 |
| `log` | "errores frescos" con 8+ matches de error | GPU | 0.95 |
| `log` | "errores frescos" con 3+ matches | tofu | 0.85 |
| `log` | "log gigante" 2+ noches | tofu | 0.85 |
| `arena` | siempre (`/tmp` > 512 MiB en `collect`) | GPU | 0.90 |
| `certificate` | "vence" | tofu | 0.85 |
| cualquiera | sin regla que aplique | `null` → hoja | 0.40 |

`chooseGift` aplica dos correcciones sobre el veredicto base:

- Dos tofus rechazados por el humano degradan el próximo tofu a hoja.
- Una GPU con 0 vidas restantes se convierte en tofu: el gato no promete
  cuidado que no puede dar.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/hunt.ts` | `HuntEngine`: orquestación, candado anti-reentrada, tope de 9 presas por ronda. |
| `src/collect.ts` | `collectLocalPrey(deps, opts)`: inventario del sistema con dependencias inyectables. |
| `src/diet.ts` | `judgeHeuristic(input)` y `chooseGift(input, heuristic)`, funciones puras. |
| `src/prey.ts` | Tipos `Prey`/`Gift`, `preyKey(category, host, title)`, etiquetas y glifos. |
| `src/narrate.ts` | `narrateGift(voice, ctx)` y `fallbackNarration(kind, prey)`. |
| `src/memory.ts` | `addGift`, `recordHunt`, registro `giftedKeys` con poda a 30 días. |

## API / Interfaz pública

```ts
// src/hunt.ts
export class HuntEngine {
  constructor(cfg: GatanasConfig, deps: HuntDeps)
  get busy(): boolean
  hunt(source: "cron" | "manual" | "request"): Promise<HuntOutcome>
}
export function fixtureCollector(preyList: Prey[]): (opts) => Promise<Prey[]>
export function timeOfDay(iso: string): string
```

| Campo de `HuntOutcome` | Tipo | Descripción |
|------------------------|------|-------------|
| `ran` | `boolean` | Si la ronda ejecutó (false = ayuno o bloqueo). |
| `reason` | `string?` | Motivo cuando no corrió. |
| `gifts` | `Gift[]` | Regalos de la ronda. |
| `found` | `number` | Presas detectadas. |
| `tokens` | `number` | Tokens gastados en narración. |

Variables de entorno relevantes: `GATANAS_HUNT_INTERVAL_SEC` (900),
`GATANAS_DAILY_BUDGET_USD` (0.5), `GATANAS_DAILY_TOKEN_BUDGET` (40000).

## Dependencias externas

- Gateway de conectores de Sprites → OpenRouter (narración de GPUs y tofus).
  Sin dependencias de npm.

## Limitaciones y consideraciones

- Los logs del runtime (`/.sprite/logs`) son de solo lectura para procesos
  externos: la presa real de "log" son los logs de aplicaciones en el home
  y en `/tmp` (ver `collect.ts`, `candidateDirs`).
- El mismo hallazgo no se regala dos veces el mismo día (`giftedKeys`);
  una hoja no se repite nunca.
- La ventana de frescura (`freshnessWindowSec`) filtra hallazgos viejos;
  en modo demo (`GATANAS_DEMO=1`) se acorta para poder ensayar.

## Referencias

- [Flujo de cacería](../architecture/data-flow.md)
- [Monedero](monedero.md)
- [Testing](../development/testing.md) (la dieta es la suite más cargada)
- Archivos fuente: `src/hunt.ts`, `src/diet.ts`, `src/collect.ts`
