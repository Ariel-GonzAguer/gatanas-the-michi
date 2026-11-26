# Documentation plan — gatanas-the-michi

Project: Gatanás The Michi, a feline personal agent running inside a
Fly.io Sprite. Stack: Node 24 + TypeScript, zero runtime dependencies.
Wiki language: English. Scope: `standard`.

## Domains and coverage

| Domain | Document | Sources |
|---------|-----------|---------|
| Architecture | `architecture/overview.md` | full `src/*.ts`, `tsconfig.json` |
| HTTP API | `architecture/routing.md` | `src/altar-server.ts` |
| Data flows | `architecture/data-flow.md` | `src/hunt.ts`, `src/chat.ts`, `src/opinion.ts`, `src/scheduler.ts` |
| Feature: hunt and diet | `features/caza-y-dieta.md` | `src/collect.ts`, `src/diet.ts`, `src/prey.ts`, `src/hunt.ts` |
| Feature: nine lives | `features/nueve-vidas.md` | `src/lives.ts`, `src/memory.ts` |
| Feature: wallet | `features/monedero.md` | `src/wallet.ts`, `src/memory.ts` |
| Feature: the lair and chat | `features/altar-y-chat.md` | `src/altar.ts`, `src/altar-server.ts`, `src/chat.ts`, `src/narrate.ts` |
| Feature: self-publishing | `features/auto-publicacion-github.md` | `src/github-publish.ts` |
| Security | `security/implementation.md` | `src/altar-server.ts`, Sprites connectors |
| Deployment | `deployment/platform.md` | `scripts/deploy.sh`, `sprite-env` |
| Incidents | `deployment/troubleshooting.md` | real development incidents (2026-11-26) |
| Testing | `development/testing.md` | `test/*.test.ts`, `tsconfig.test.json` |
| Workflow | `development/workflow.md` | `package.json`, `README.md` |

## Adaptation decisions

- No `.github/workflows/` → no `ci-cd/` is created.
- No PWA → no `deployment/pwa.md` is created.
- 5 highlighted features → a `features/` directory with one file per
  feature.
- No external database: the "backend" is the Sprite's own HTTP server; it
  is documented under `architecture/` instead of `backend/`.
- No external monitoring → no `deployment/monitoring.md` is created.
- The only tenant of `utils/` is `types.ts` (re-exports); it is documented
  in `architecture/overview.md` and doesn't warrant a directory of its own.

## Quality Gate status

- [x] Structure created and adapted to the real project.
- [x] All documents with a References section.
- [x] Internal links verified against existing files.
- [x] No empty sections or placeholders.
- [x] `quickstart.md` links 100% of the documents.
- [x] Troubleshooting with incidents backed by development evidence.
