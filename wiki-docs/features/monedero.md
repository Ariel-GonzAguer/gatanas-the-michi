# Feature: el monedero

El gato conoce el tope de la API key de su humano y se frena solo antes de
gastarlo. Un agente con presupuesto finito que ayuna en vez de quebrar.

## ¿Qué es y por qué está aquí?

La API key de OpenRouter de esta casa tiene un tope de 6.66 USD. Sin control,
un agente que narra cada 15 minutos y conversa con visitantes puede comerase
el presupuesto en horas. El monedero hace el gasto visible y la decisión de
parar explícita, con dos niveles: tope diario y tope de la llave.

## Cómo funciona (flujo técnico)

```
ronda de cacería / rumiación
        │
        ▼
Wallet.canSpend()
        ├── spentTodayUsd >= dailyBudgetUsd ──→ no: "presupuesto de hoy agotado"
        ├── spentUsd >= capUsd - RESERVE_USD ──→ no: "la llave está casi en su tope"
        └── sí ──→ Voice.chat(...) ──→ Wallet.charge(cost, tokens)
                                        │
                                        ▼
                        memory.recordCharge(usd)  → usdByDay[hoy] += usd
                                                   → spentUsd += usd
                        memory.recordTokens(n)    → tokensByDay[hoy] += n
```

- `RESERVE_USD = 0.5`: margen de seguridad para que el gato nunca llegue al
  tope exacto de la llave.
- El gasto real lo reporta OpenRouter en cada respuesta (`usage.cost`);
  no es una estimación propia.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/wallet.ts` | `Wallet`: `canSpend`, `charge`, `state`, `mood`. |
| `src/memory.ts` | `recordCharge` / `recordTokens` / `spentTodayUsd` / `tokensToday`. |
| `src/hunt.ts` | Consulta `canSpend` antes de la ronda y entre presas. |
| `src/scheduler.ts` | La rumiación también pasa por el monedero. |
| `src/altar-server.ts` | Expone `wallet` en `GET /api/status`. |

## API / Interfaz pública

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

`WalletState` (visible en `GET /api/status`):

| Campo | Descripción |
|-------|-------------|
| `spentUsd` | Gasto acumulado desde que nació. |
| `capUsd` | Tope de la llave (6.66 por defecto). |
| `dailyCapUsd` | Tope diario (`GATANAS_DAILY_BUDGET_USD`, 0.5). |
| `spentTodayUsd` | Gasto de hoy. |

## Dependencias externas

- Ninguna en runtime. El dato de costo llega en la respuesta del gateway de
  OpenRouter y se persiste localmente.

## Limitaciones y consideraciones

- El monedero mide el gasto de ESTA llave desde que el acta existe: si la key
  ya tenía gasto previo en OpenRouter, ese historial no está en el acta.
- `spentUsd` se recalcula desde `usdByDay` si el campo falta (migración de
  actas viejas), ver `Memory.load`.
- Los modelos `:free` de OpenRouter no consumen el tope de la llave; la
  cadena de chat (free primero) existe precisamente para estirar este
  presupuesto (ver [altar y chat](altar-y-chat.md)).

## Referencias

- [Caza y dieta](caza-y-dieta.md) (quién consulta el monedero)
- [Flujos de datos](../architecture/data-flow.md)
- Archivo fuente: `src/wallet.ts`
- Configuración: `.env.example` (`GATANAS_DAILY_BUDGET_USD`)
