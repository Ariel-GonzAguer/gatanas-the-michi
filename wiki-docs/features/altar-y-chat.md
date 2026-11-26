# Feature: el altar y el chat

El altar es la única página del proyecto: una URL pública donde el gato
muestra su acta, su opinión y sus regalos, y donde se le puede hablar o
acariciar. Sin frameworks, sin CDNs, sin build de frontend.

## ¿Qué es y por qué está aquí?

Un agente que vive en un servidor necesita una cara visible. La decisión de
diseño fue hacerla con una sola función que devuelve un documento HTML
completo con CSS y JS inline: nada que cargar, nada que actualizar, y la
estética (gato callejero, servidor viejo, noche) es parte del producto.

## Cómo funciona (flujo técnico)

```
GET /  ──→  altar-server arma AltarSnapshot ──→ altarHtml(s) ──→ HTML
                                                            │
        (el JS inline de la página)                         │
             │ POST /api/chat {message}                     │
             │ POST /api/purr                               │
             ▼                                              ▼
        speak() ──→ cadena de modelos ──→ reply ──→ se pinta en el hilo
```

Estados del gato en la página (decididos por el servidor, pintados por el
cliente):

| Estado | Condición | Gato ASCII |
|--------|-----------|------------|
| despierto | sonda de vigilia fresca y sin ventana de revive | `( o.o )` con ojos dorados |
| dormido | vigilia fresca pero en ventana — no ocurre salvo revive | `( -.- )` zZz |
| reviviendo | sin sonda fresca (proceso caído) o en ventana de revive | `( x.x )` |

Secciones de la página:

- **Mi opinión sobre mi humano**: la confesión rumiada una vez al día.
- **El altar**: hasta 30 regalos vivos (los rechazados no se pintan), cada
  uno con glifo SVG (GPU dorada, hoja, tofu con moho), narración, origen y
  disección práctica.
- **Cifras**: vidas, caricias, cacerías, GPUs, tofus, hojas.
- **Hablarle al gato**: hilo de chat + botón de acariciar.

El chat (`src/chat.ts`):

1. `cannedReply` contesta intents comunes sin gastar tokens (caricias,
   churus/comida, "cómo estás", "qué haces").
2. Si no es canned, arma un prompt con el contexto real del acta (vidas,
   caricias, últimos regalos, opinión previa como dato, no como turno) y
   llama `Voice.chat("chat", ...)`.
3. La cadena de modelos: `google/gemma-4-31b-it:free` primero y
   `z-ai/glm-5.3-flash` (pagado) como último recurso. Cada eslabón absorbe
   429 upstream y respuestas vacías de modelos que razonan.
4. `stripMarkdown` limpia la prosa del modelo antes de mostrarla.

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/altar.ts` | `altarHtml(snapshot)`: documento completo; `esc()` para todo texto dinámico. |
| `src/altar-server.ts` | Rutas HTTP, limitadores, cabeceras, armado del snapshot. |
| `src/chat.ts` | `speak(voice, memory, text)` e intents `cannedReply`. |
| `src/narrate.ts` | `PERSONA` (voz costarricense del gato) y `stripMarkdown`. |
| `src/opinion.ts` | La rumiación que pinta la sección de opinión. |
| `src/prey.ts` | `giftGlyph(kind)`: los tres SVG inline del altar. |

## API / Interfaz pública

```ts
// src/altar.ts
export interface AltarSnapshot {
  name: string; memory: GatanasMemory; alive: boolean; awake: boolean;
  lastWatchAt: string | null; voiceOk: boolean; lives: number;
  purrDrought: number; now: string;
}
export function altarHtml(s: AltarSnapshot): string
```

Rutas involucradas: `GET /`, `POST /api/chat`, `POST /api/purr`,
`GET /api/status`, `GET /api/gifts` (tabla completa en
[routing](../architecture/routing.md)).

## Dependencias externas

- Ninguna para el frontend (todo inline).
- El chat depende del gateway de Sprites → OpenRouter.

## Limitaciones y consideraciones

- El hilo de chat vive solo en el navegador (no se persiste): recargar la
  página lo limpia. Las caricias y regalos sí son persistentes.
- Todo texto dinámico pasa por `esc()`; existe un test que alimenta
  narraciones con `<script>` y `<img onerror>` y verifica que no llegan al
  HTML (ver [testing](../development/testing.md)).
- El modelo puede tardar; el proxy del Sprite puede cortar antes (502) si la
  cadena de modelos se alarga. La cadena actual es de a lo sumo 2 eslabones
  por esa razón (ver [troubleshooting](../deployment/troubleshooting.md)).

## Referencias

- [HTTP API](../architecture/routing.md)
- [Flujo de conversación](../architecture/data-flow.md)
- [Seguridad](../security/implementation.md)
- Archivos fuente: `src/altar.ts`, `src/chat.ts`
