# Arquitectura — visión general

Gatanás The Michi es un agente personal que vive dentro de un Sprite de Fly.io:
un único proceso Node que sirve una página web (el altar), caza problemas en su
propia máquina y conversa por un LLM. No hay frameworks, ni CDN, ni build de
frontend: solo TypeScript compilado a ESM plano.

## 1. Resumen

El sistema tiene tres capas: entrada de eventos (HTTP y temporizadores),
dominio felino (caza, dieta, vidas, monedero, opinión) e infraestructura
(APIs de Sprites y persistencia del acta). Toda decisión de negocio es
determinista y local; el modelo de lenguaje solo redacta, nunca decide.

## 2. Componentes

Inventario completo del código fuente en `src/`.

| Módulo | Ubicación | Descripción |
|--------|-----------|-------------|
| `main` | `src/main.ts` | Punto de entrada del proceso: arma el runtime, abre el puerto 8080, arranca el pulso y maneja SIGTERM/SIGINT. |
| `altar-server` | `src/altar-server.ts` | Servidor HTTP estándar: altar, API JSON, limitadores de golpes y cabeceras de seguridad. |
| `altar` | `src/altar.ts` | La página única del altar: HTML+CSS+JS inline, sin dependencias externas. |
| `scheduler` | `src/scheduler.ts` | El pulso: rondas de cacería cada `huntIntervalSec`, sondas de vigilia cada 30 s, rumiación diaria, ventanas de revive. |
| `hunt` | `src/hunt.ts` | Motor de cacería (`HuntEngine`): orquesta recolección, dieta, narración y altar. |
| `collect` | `src/collect.ts` | Recolección de presas del propio sistema: disco, `/tmp`, procesos zombis, logs con errores frescos. |
| `providers/applogs` | `src/providers/applogs.ts` | Utilidades de escaneo de logs de aplicaciones (scoring de líneas de error). |
| `providers/hetzner` | `src/providers/hetzner.ts` | Providencia opcional (fuera del camino crítico). |
| `diet` | `src/diet.ts` | Heurística que clasifica cada presa en GPU, hoja de árbol o tofu fermentado. |
| `prey` | `src/prey.ts` | Tipos de presa y regalo, `preyKey`, etiquetas, glifos SVG del altar. |
| `narrate` | `src/narrate.ts` | `PERSONA` del gato y narración de regalos (con repertorio local de respaldo). |
| `chat` | `src/chat.ts` | Conversación: intents canned y llamada al modelo con contexto del acta. |
| `opinion` | `src/opinion.ts` | Rumiación diaria: la confesión persistente sobre el humano. |
| `opinion-types` | `src/opinion-types.ts` | Tipos de opinión, separados para romper dependencias circulares. |
| `lives` | `src/lives.ts` | `NineLives`: checkpoints del Sprite como vidas, restauración y renacimiento. |
| `memory` | `src/memory.ts` | El acta: JSON persistente con escritura atómica (tmp + rename). |
| `wallet` | `src/wallet.ts` | El monedero: gasto real en USD contra el tope de la llave de OpenRouter. |
| `config` | `src/config.ts` | Configuración por variables de entorno con defaults sensatos. |
| `cli` | `src/cli.ts` | Terminal: `hunt`, `meow`, `altar`, `lives`, `revive` (alias `nahualada`). |
| `github-publish` | `src/github-publish.ts` | Publicación del propio repo por la API de GitHub vía conector OAuth. |
| `deliver` | `src/deliver.ts` | Reparto de regalos (Pushover opcional por conector; altar como destino por defecto). |
| `types` | `src/types.ts` | Reexportaciones de tipos públicos para consumidores externos y tests. |

## 3. Relación entre capas

```
┌──────────────────────────── entrada ────────────────────────────┐
│  HTTP (altar-server)      Scheduler (cron)      CLI (cli.ts)    │
└──────┬────────────────────────┬────────────────────┬──────────┘
       │                        │                    │
┌──────▼────────────────────────▼────────────────────▼──────────┐
│                        dominio felino                          │
│  HuntEngine → collect → diet → narrate → memory.addGift        │
│  speak / ruminate / Wallet.canSpend / NineLives                │
└──────┬────────────────────────┬───────────────────────────────┘
       │                        │
┌──────▼─────────┐   ┌─────────▼──────────┐   ┌────────────────┐
│ Voice (habitat) │   │ SpritesApi (habitat)│  │ Memory (acta)  │
│ gateway         │   │ plano de control    │  │ memory.json    │
│ OpenRouter      │   │ checkpoints/exec    │  │ en disco       │
└─────────────────┘   └────────────────────┘   └────────────────┘
```

- `Voice` habla con el gateway de conectores de Sprites, que adjunta la API
  key de OpenRouter según la identidad del Sprite. El proceso nunca ve la key.
- `SpritesApi` usa `SPRITES_TOKEN` (opcional) para checkpoints, servicios y
  exec: sin token, el gato caza y conversa pero no puede morir ni revivir.
- `Memory` escribe en `GATANAS_HOME/memory.json` con cola de escritura y
  rename atómico: un apagón a mitad de nahualada no corrompe el acta.

## 4. Decisiones y convenciones

- **Cero dependencias de runtime**: `dependencies` está vacío en
  `package.json`; todo usa la librería estándar de Node. El deploy no
  ejecuta `npm install` en el Sprite.
- **El modelo no decide**: `diet.ts` clasifica con heurística pura; el LLM
  solo redacta la narración. Una regla falsa del modelo no puede convertir
  una hoja en GPU.
- **Frugalidad como carácter**: las hojas de árbol no gastan tokens
  (`fallbackNarration`); el monedero frena la caza cuando el gasto se acerca
  al tope de la llave.
- **ESM estricto**: imports con extensión `.js`, `type: module`,
  `verbatimModuleSyntax`. TypeScript se compila a `dist/` con `tsc`.
- **Determinismo testeable**: `HuntEngine`, `Memory` y `collectLocalPrey`
  reciben sus colaboradores por inyección; los tests usan dobles
  (ver [testing](../development/testing.md)).

## 5. Problemas comunes

Los incidentes operativos (respuestas vacías del modelo, 429 de los modelos
free, ediciones del acta pisadas por SIGTERM) están documentados con causa y
solución en [troubleshooting](../deployment/troubleshooting.md).

## Referencias

- [Flujos de datos](data-flow.md)
- [HTTP API](routing.md)
- [Caza y dieta](../features/caza-y-dieta.md)
- Archivo fuente: `src/main.ts`
- Configuración: `src/config.ts`, `.env.example`
