# Feature: las nueve vidas

Las vidas del gato son checkpoints reales del Sprite: morir es restaurar un
checkpoint, y el acta sobrevive a sus propias muertes.

## ¿Qué es y por qué está aquí?

Un Sprite puede tomar checkpoints y restaurarlos. Restaurar rebobina el disco
entero, incluido `memory.json` — el acta del gato. El problema no trivial es
ese: un gato que muere no puede olvidar que murió. `NineLives` resuelve la
secuencia: anota todo ANTES de restaurar, y DESPUÉS reconcilia el acta
rebobinada con lo que había escrito.

## Cómo funciona (flujo técnico)

```
POST /api/revive {"reason"}   o   cli revive
        │
        ▼
livesRemaining > 0 y api.canManage ──no──→ null (no muere quien no puede volver)
        │
        ▼
spendLife(reason)
        │
        ├── 1. event "restored" al acta + vidas-1 (se guarda ANTES)
        ├── 2. snapshot de checkpoints en memoria
        ├── 3. api.restoreCheckpoint(id)
        │        └── error ──→ vida devuelta + evento removido (throw)
        └── 4. reconciliación: checkpoints restaurados,
                 y si el disco traía un acta vieja, el evento se re-registra
```

- `takeCheckpoint(comment)` crea el checkpoint por el plano de control y
  guarda un `CheckpointRef` en el acta (tope de 20 referencias).
- `loseLife(reason)` es la muerte por accidente (tirar algo de la mesa):
  consume vida sin restaurar nada.
- `reincarnate(reason)` devuelve las `cfg.lives` vidas completas sin borrar
  los regalos del altar.
- Tras una restauración reciente, el `Scheduler` entra en ventana de
  "reviviendo" (20 s) en la que no caza ni conversa, y el altar dibuja al
  gato en trance.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/lives.ts` | `NineLives`: `takeCheckpoint`, `spendLife`, `loseLife`, `reincarnate`, `narrative(event)`. |
| `src/habitat.ts` | `SpritesApi.createCheckpoint` / `restoreCheckpoint` (plano de control, `SPRITES_TOKEN`). |
| `src/memory.ts` | `checkpoints: CheckpointRef[]`, `lifeEvents: LifeEvent[]`, `livesRemaining`. |
| `src/scheduler.ts` | Ventana de revive al despertar de una restauración. |
| `src/altar-server.ts` | `POST /api/revive` (alias `/api/nahualada`), `GET /api/lives`. |
| `src/cli.ts` | `node dist/cli.js revive` / `lives`. |

## API / Interfaz pública

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
export function fakeSpritesApi(opts?: { fail?: boolean }): SpritesApi  // para tests
```

| Método | Devuelve `null` cuando |
|--------|------------------------|
| `spendLife` | no quedan vidas, o no hay llave del plano de control |
| `takeCheckpoint` | no hay llave, o el plano de control falló |

`LifeState` expuesto por `GET /api/lives`: `livesRemaining`, `lives`,
`lastCheckpoint`, `events`.

## Dependencias externas

- Plano de control de Sprites (`SPRITES_TOKEN`): `POST /v1/sprites/<n>/checkpoints`
  y `/restore`. Sin token, la feature queda inerte pero el resto del agente
  funciona normal.

## Limitaciones y consideraciones

- La restauración rebobina TODO el disco, no solo el acta: cualquier archivo
  no respaldado en el checkpoint se pierde. Por eso el flujo guarda el evento
  antes de restaurar.
- El contador de vidas es honesto, no decorativo: `spendLife` que falla en la
  restauración devuelve la vida (regla cubierta por test).
- Los checkpoints del Sprite consumen espacio en disco; `takeCheckpoint`
  mantiene a lo sumo 20 referencias en el acta, pero los checkpoints reales
  se acumulan en el plano de control.

## Referencias

- [Arquitectura general](../architecture/overview.md)
- [Deployment en Sprites](../deployment/platform.md)
- [Testing](../development/testing.md) (`test/lives.test.ts` cubre el pacto completo)
- Archivo fuente: `src/lives.ts`
