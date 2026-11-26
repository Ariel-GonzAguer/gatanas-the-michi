# Plan de documentación — gatanas-the-michi

Proyecto: Gatanás The Michi, agente personal felino que corre dentro de un
Sprite de Fly.io. Stack: Node 24 + TypeScript, cero dependencias de runtime.
Idioma de la wiki: español. Alcance: `standard`.

## Dominios y cobertura

| Dominio | Documento | Fuentes |
|---------|-----------|---------|
| Arquitectura | `architecture/overview.md` | `src/*.ts` completo, `tsconfig.json` |
| HTTP API | `architecture/routing.md` | `src/altar-server.ts` |
| Flujos de datos | `architecture/data-flow.md` | `src/hunt.ts`, `src/chat.ts`, `src/opinion.ts`, `src/scheduler.ts` |
| Feature: caza y dieta | `features/caza-y-dieta.md` | `src/collect.ts`, `src/diet.ts`, `src/prey.ts`, `src/hunt.ts` |
| Feature: nueve vidas | `features/nueve-vidas.md` | `src/lives.ts`, `src/memory.ts` |
| Feature: monedero | `features/monedero.md` | `src/wallet.ts`, `src/memory.ts` |
| Feature: altar y chat | `features/altar-y-chat.md` | `src/altar.ts`, `src/altar-server.ts`, `src/chat.ts`, `src/narrate.ts` |
| Feature: auto-publicación | `features/auto-publicacion-github.md` | `src/github-publish.ts` |
| Seguridad | `security/implementation.md` | `src/altar-server.ts`, conectores de Sprites |
| Despliegue | `deployment/platform.md` | `scripts/deploy.sh`, `sprite-env` |
| Incidentes | `deployment/troubleshooting.md` | incidentes reales del desarrollo (2026-11-26) |
| Testing | `development/testing.md` | `test/*.test.ts`, `tsconfig.test.json` |
| Workflow | `development/workflow.md` | `package.json`, `README.md` |

## Decisiones de adaptación

- Sin `.github/workflows/` → no se crea `ci-cd/`.
- Sin PWA → no se crea `deployment/pwa.md`.
- 5 funcionalidades destacadas → directorio `features/` con un archivo por feature.
- Sin base de datos externa: el "backend" es el propio servidor HTTP del
  Sprite; se documenta bajo `architecture/` en lugar de `backend/`.
- Sin monitoreo externo → no se crea `deployment/monitoring.md`.
- El único inquilino de `utils/` es `types.ts` (reexportaciones); se documenta
  en `architecture/overview.md` y no amerita directorio propio.

## Estado del Quality Gate

- [x] Estructura creada y adaptada al proyecto real.
- [x] Todos los documentos con sección Referencias.
- [x] Links internos verificados contra archivos existentes.
- [x] Sin secciones vacías ni placeholders.
- [x] `quickstart.md` enlaza el 100% de los documentos.
- [x] Troubleshooting con incidentes respaldados por evidencia del desarrollo.
