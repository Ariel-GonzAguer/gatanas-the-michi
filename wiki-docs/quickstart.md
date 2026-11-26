# Quickstart — mapa de la wiki

Gatanás The Michi: agente personal felino que vive dentro de un Sprite de
Fly.io, caza problemas de su propia máquina, los narra con un LLM por el
gateway de conectores y guarda todo en su acta. Node 24 + TypeScript, cero
dependencias de runtime.

## Inicio rápido (local)

1. `npm install` (solo `typescript` y `@types/node` como devDependencies).
2. `npm run build`.
3. `npm test` — 29 pruebas sin red ni disco real.
4. `GATANAS_HOME=/tmp/gato PORT=8099 GATANAS_HUNT_INTERVAL_SEC=0 npm start`
   — el altar queda en `http://localhost:8099`.
5. Para operar el real: `SPRITES_TOKEN=… bash scripts/deploy.sh`
   (ver [deployment](deployment/platform.md)).

## Stack resumido

| Capa | Tecnología |
|------|------------|
| Lenguaje | TypeScript 5.6 → ESM (`tsc`, sin bundler) |
| Runtime | Node 24 (>= 22.6 por `--experimental-strip-types`) |
| Servidor | `node:http` estándar, HTML/CSS/JS inline |
| Tests | `node --test` + `node:assert/strict` |
| Plataforma | Fly.io Sprites (servicio gestionado por `sprite-env`) |
| LLM | OpenRouter vía gateway de conectores (chat: modelos `:free` con reserva pagada) |
| Persistencia | `memory.json` en el disco persistente del Sprite |

## Mapa de la wiki

### Arquitectura
- [Visión general](architecture/overview.md) — capas, inventario completo de módulos, decisiones.
- [HTTP API](architecture/routing.md) — rutas del altar, errores, limitadores, cabeceras.
- [Flujos de datos](architecture/data-flow.md) — cacería, conversación, rumiación.

### Funcionalidades destacadas
- [Caza y dieta](features/caza-y-dieta.md) — heurística GPU/hoja/tofu con umbrales exactos.
- [Nueve vidas](features/nueve-vidas.md) — checkpoints del Sprite como vidas; el acta sobrevive al rebobinado.
- [Monedero](features/monedero.md) — presupuesto contra el tope de la llave; el gato ayuna.
- [Altar y chat](features/altar-y-chat.md) — la página pública y la cadena de modelos del chat.
- [Auto-publicación del repo](features/auto-publicacion-github.md) — commits por la API de GitHub vía conector OAuth.

### Seguridad
- [Implementación](security/implementation.md) — perímetro HTTP, escaping, custodia BYOK, límites del modelo.

### Despliegue y operación
- [Plataforma](deployment/platform.md) — el Sprite, el servicio, el deploy, la persistencia.
- [Troubleshooting](deployment/troubleshooting.md) — incidentes reales con causa y solución.

### Desarrollo
- [Testing](development/testing.md) — suite, dobles, convenciones.
- [Workflow](development/workflow.md) — scripts, compilación, smoke tras deploy.

## Próximos pasos para devs nuevos

1. Leer [arquitectura](architecture/overview.md) para ubicar los 22 módulos.
2. Correr `npm test` y leer `test/diet.test.ts`: fija el contrato central.
3. Mirar [flujos de datos](architecture/data-flow.md) antes de tocar
   `hunt.ts` o `chat.ts`.
4. Para operar en el Sprite real, [deployment](deployment/platform.md) y
   [troubleshooting](deployment/troubleshooting.md) son obligatorios.
