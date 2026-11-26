# Troubleshooting — incidentes reales

Entradas extraídas de incidentes reales ocurridos durante el desarrollo y la
operación del agente (2026-11-26). Cada una tiene la evidencia que la
respalda.

---

### El chat responde vacío o con el fallback de cansancio

**Síntoma**: `POST /api/chat` devuelve el reply de respaldo ("Te escuché,
pero no me salen las palabras…") aunque el gateway responde 200.

**Causa**: los modelos que razonan antes de escribir (GLM 5.3 Flash,
Nemotron con reasoning) devuelven `choices[0].message.content: null` con
`finish_reason: "length"` cuando `max_tokens` no alcanza para el monólogo
interno más la respuesta.

**Solución**:
1. Dar headroom fijo a `max_tokens` (`REASONING_HEADROOM = 2200` en
   `src/habitat.ts`; se aplica siempre porque el margen no usado no cuesta).
2. Tratar `content` vacío como error (throw) para que la cadena de modelos
   y el repertorio de emergencia entren en juego.

**Verificación**: pedir un chat y revisar que el log no tenga
`la voz del gato falló: respuesta vacía`.

**Referencias**: `src/habitat.ts` (`chatOnce`), `src/chat.ts` (`tiredReply`).

---

### 429 upstream en los modelos `:free`

**Síntoma**: `{"error":{"code":429,...,"is_byok":false}}` desde OpenRouter
para `google/gemma-4-31b-it:free` u otros `:free`.

**Causa**: los modelos free corren en pools compartidos upstream que se
saturan por ratos; el 429 lo emite el proveedor, no OpenRouter.

**Solución**:
1. Encadenar modelos para el chat (`chatModelFallbacks`): free primero,
   pagado de último recurso (`src/config.ts`).
2. No reintentar en bucle: la cadena ya es el reintento.

**Verificación**: `GET /api/status` sigue en 200 y el chat responde aunque
el free esté saturado (consume del pagado).

**Referencias**: `src/habitat.ts` (`Voice.chat`), `.env.example`
(`GATANAS_MODEL_CHAT_FALLBACKS`).

---

### 502 del proxy del Sprite en `/api/chat`

**Síntoma**: la URL pública devuelve 502 con HTML de error mientras el
mismo endpoint por localhost responde bien.

**Causa**: la ventana de tiempo del proxy es acotada; un eslabón lento
(p. ej. un modelo de razonamiento como `nvidia/nemotron-3.5-lightning:free`)
consume la ventana antes de que la cadena termine.

**Solución**:
1. Sacar los eslabones lentos de la cadena de chat (la cadena quedó en 2:
   gemma free → glm flash).
2. Mantener `GATANAS_MODEL_TIMEOUT_MS` (30000) por debajo de la ventana
   del proxy para que el eslabón de reserva tenga tiempo.

**Verificación**: chats sucesivos por la URL pública responden 200 en <30 s.

**Referencias**: `src/config.ts`, `src/habitat.ts`.

---

### Git Data API falla con 409 en un repo nuevo

**Síntoma**: `POST /repos/<repo>/git/blobs` (o `trees`, `commits`) responde
`409 {"message": "Git Repository is empty."}`.

**Causa**: la Git Data API no opera sobre repos sin un solo commit; el repo
se creó vacío desde la web.

**Solución**:
1. Crear el primer archivo con `PUT /repos/<repo>/contents/<path>` y un
   `content` base64: eso crea la rama `main` y el commit inicial.
2. Recién después usar el flujo blob→tree→commit→ref.

**Verificación**: `GET /repos/<repo>/branches` devuelve `main`.

**Referencias**: `src/github-publish.ts`.

---

### Archivos borrados del repo reaparecen en la publicación siguiente

**Síntoma**: se borran archivos del repo (p. ej. sondas de prueba) y vuelven
a aparecer tras el próximo `github-publish.js`.

**Causa**: el script publica el ÁRBOL DE TRABAJO del Sprite; si el archivo
sigue en el árbol, se vuelve a subir. Además `base_tree` fusiona con el
árbol remoto: no reemplaza.

**Solución**:
1. Borrar los archivos no deseados del árbol de trabajo del Sprite antes
   de publicar.
2. Verificar con `GET /repos/<repo>/contents/` después de cada publicación.

**Referencias**: `src/github-publish.ts` (`collectFiles`, `SKIP_*`).

---

### Ediciones externas de `memory.json` se pierden

**Síntoma**: se edita el acta en el disco y, tras reiniciar el servicio, la
edición desaparece.

**Causa**: el handler de SIGTERM guarda el estado en memoria del proceso
sobre el archivo, pisando la edición externa.

**Solución**:
1. `sprite-env services stop gatanas`.
2. Editar `/home/sprite/.gatanas/memory.json`.
3. `sprite-env services start gatanas`.

**Verificación**: `GET /api/status` refleja la edición tras el arranque.

**Referencias**: `src/main.ts` (shutdown), `src/memory.ts`.

---

### Inyectar la opinión como turno `assistant` degrada el chat

**Síntoma**: con la opinión persistida en el acta, las respuestas del chat
empeoran o llegan vacías.

**Causa**: pasar la confesión previa como turno `role: "assistant"` del
historial confunde al modelo (intenta "continuar" su propio monólogo en
lugar de responder).

**Solución**:
1. Incluir la opinión como dato dentro del prompt de usuario ("Lo que ya
   opinás de él (no lo repitas literal, evolucioná): …").

**Verificación**: chats con opinión presente responden con carácter y sin
repetir la confesión literal.

**Referencias**: `src/chat.ts` (`speak`).

---

### El texto del acta quedó con la onomatopeya o palabras viejas

**Síntoma**: regalos viejos del altar muestran "mrrp" o "atún" después de
un cambio de vocabulario del gato.

**Causa**: las narraciones son texto persistido: el cambio de persona solo
afecta generaciones futuras.

**Solución**:
1. Parar el servicio (ver entrada anterior), reemplazar en el JSON
   (`mrrp` → `prrrr`, `atún` → `churus`) en `gifts[*].narration/advice/
   huntNotes` y `opinion.quote`, y arrancar de nuevo.

**Verificación**: `GET /api/gifts` no contiene la palabra vieja.

**Referencias**: `src/narrate.ts` (`PERSONA`), `src/memory.ts`.

---

### `sprite exec` dice "command required" y el comando corre en tu máquina

**Síntoma**: pegar la invocación en dos líneas — `sprite exec -s <sprite>
--no-stdin --` arriba y el comando abajo — produce `Error: command required`
y después el comando se ejecuta **localmente**, con errores que no tienen
sentido dentro del Sprite (p. ej. `find: '/tmp/systemd-private-…':
Permission denied`, un directorio de systemd que solo existe en la máquina
desde la que se llama).

**Causa**: el salto de línea parte la invocación en dos comandos bash
independientes. El primero queda sin comando remoto; el segundo corre en la
máquina local, no en el Sprite.

**Solución**:
1. Todo en una sola línea, o cerrar la línea con `\` de continuación.
2. Comandos remotos con pipes o `&&`: envolverlos en
   `bash -c 'comando completo'`.

**Verificación**: `sprite exec -s <sprite> --no-stdin -- hostname` devuelve
el nombre del Sprite. Regla del prompt: `sprite@<sprite>` = dentro;
cualquier otro usuario = tu máquina.

**Referencias**: CLI `sprite exec --help`; [workflow §5](../development/workflow.md).
