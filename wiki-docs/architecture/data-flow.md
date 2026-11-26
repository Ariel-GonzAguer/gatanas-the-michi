# Flujos de datos

Tres flujos concentran casi todo el comportamiento del agente: la cacería, la
conversación y la rumiación diaria. Los tres escriben en el mismo acta
(`memory.json`) y pasan por el monedero antes de gastar tokens.

## 1. Flujo de cacería

Trigger: `Scheduler` cada `GATANAS_HUNT_INTERVAL_SEC` (900 s), `POST /api/hunt`
o `node dist/cli.js hunt`.

```
┌──────────┐   ┌────────────┐   ┌──────────┐   ┌───────────┐
│ Scheduler │──→│ HuntEngine │──→│  collect │──→│   diet    │
│  (cron)   │   │  .hunt()   │   │ presas   │   │ GPU/hoja/ │
└──────────┘   └─────┬──────┘   └──────────┘   │  tofu     │
                     │                          └─────┬─────┘
        ┌────────────▼──────────────────────────────────▼───────┐
        │ ¿hoja confiable? → fallbackNarration (0 tokens)       │
        │ si no → narrateGift → Voice → gateway → OpenRouter    │
        └────────────┬──────────────────────────────────────────┘
                     │
        ┌────────────▼──────────┐   ┌───────────────────────┐
        │ memory.addGift + save │──→│ deliver (opcional)    │
        │ giftedKeys[día]       │   │ altar siempre recibe  │
        └───────────────────────┘   └───────────────────────┘
```

Pasos:

1. `Wallet.canSpend()` decide si la ronda arranca (tope diario y tope de la
   llave; ver [monedero](../features/monedero.md)). Si no autoriza, la caza
   no corre y el motivo queda en el log.
2. `collectLocalPrey` inventaría el propio sistema: porcentaje de disco,
   caja de arena (`/tmp` > 512 MiB), procesos zombis de `/proc`, errores
   frescos en logs recientes.
3. `judgeHeuristic` + `chooseGift` clasifican cada presa. El modelo no
   interviene en la clasificación.
4. Las hojas de árbol con confianza alta se narran con repertorio local
   (cero tokens). GPUs y tofus se narran con `Voice.chat("meow", ...)`.
5. Cada regalo entra al acta y se marca `giftedKeys[prey.key] = hoy` para no
   repetir el mismo regalo el mismo día.
6. `deliver` (Pushover por conector, si está configurado) nunca puede fallar
   la cacería: su error se registra y el regalo queda igual en el altar.

## 2. Flujo de conversación

Trigger: `POST /api/chat`.

```
mensaje ──→ speak() ──→ ¿intent canned? ──sí──→ respuesta local
                         │
                         no
                         ▼
              prompt con contexto del acta
              (vidas, caricias, regalos, opinión previa)
                         │
                         ▼
              Voice.chat("chat") ──→ google/gemma-4-31b-it:free
                         │ 429 o vacío
                         ▼
              z-ai/glm-5.3-flash (pagado, último recurso)
                         │
                         ▼
              stripMarkdown ──→ reply JSON
```

Detalles clave:

- Los intents canned (`acarici*`, `churus|atún|comida`, `cómo estás`,
  `qué haces`) se responden sin tokens.
- La cadena de modelos vive en `Voice.chat`: para la tarea `chat` prueba el
  modelo asignado y luego `chatModelFallbacks`. Cada eslabón absorbe 429
  upstream y respuestas vacías de modelos que razonan.
- La opinión previa del gato viaja dentro del prompt de usuario, no como
  turno `assistant`: inyectarla como turno propio degradaba las respuestas
  (ver [troubleshooting](../deployment/troubleshooting.md)).
- Si toda la cadena falla, `tiredReply()` responde con carácter en vez de
  un vacío.

## 3. Flujo de rumiación (opinión diaria)

Trigger: `Scheduler` al arrancar y luego cada hora; `shouldRuminate` solo
deja pasar una rumiación por día natural.

```
Scheduler (cada 1 h) ──→ shouldRuminate ──→ ruminate(voice, input)
                                                        │
                        ┌───────────────────────────────┘
                        ▼
             prompt: regalos, caricias, sequía de caricias,
             presupuesto restante, opinión anterior
                        │
                        ▼
             memory.setOpinion(quote) ──→ se pinta en el altar
```

- `input.purrDrought` es los días desde la última caricia (`Memory.purrDrought`).
- La confesión empieza siempre con el prefijo
  `CONFESSION_PREFIX = "Mi opinión sobre mi humano:"` y evoluciona: hay
  respuestas distintas para cero caricias, mayoría de tofus, GPUs entregadas
  o una casa "demasiado limpia".

## Referencias

- [Caza y dieta](../features/caza-y-dieta.md)
- [Altar y chat](../features/altar-y-chat.md)
- Archivos fuente: `src/hunt.ts`, `src/chat.ts`, `src/opinion.ts`, `src/scheduler.ts`
