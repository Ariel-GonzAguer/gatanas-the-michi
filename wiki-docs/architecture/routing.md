# HTTP API — el altar y sus rutas

El servidor (`src/altar-server.ts`) es un `http.Server` de la librería estándar
que escucha en `PORT` (8080). El proxy del Sprite enruta la URL pública HTTPS
a ese puerto.

## 1. Resumen

Dos familias de rutas: la página del altar (HTML) y la API JSON que consume el
JS inline de esa misma página o cualquier cliente externo. Todas las respuestas
JSON usan `Cache-Control: no-store` y el mismo bloque de cabeceras de
seguridad.

## 2. Rutas

| Método | Ruta | Handler | Descripción |
|--------|------|---------|-------------|
| GET | `/` y `/altar` | página del altar | HTML completo con opinión, regalos, cifras y chat. |
| GET | `/robots.txt` | texto plano | `Disallow: /api/` para todo user-agent. |
| GET | `/api/status` | JSON | Estado: vivo, despierto, vidas, caricias, cacerías, regalos, monedero, opinión. |
| GET | `/api/gifts` | JSON | Los 50 regalos más recientes del altar. |
| GET | `/api/lives` | JSON | Estado de `NineLives`: vidas restantes, checkpoints, eventos. |
| POST | `/api/chat` | JSON | Hablarle al gato. Body: `{"message": "..."}` (máx. 1200 chars tras recorte). |
| POST | `/api/purr` | JSON | Acariciarlo: incrementa el contador persistente. |
| POST | `/api/hunt` | JSON | Una ronda de cacería inmediata. Devuelve el outcome completo. |
| POST | `/api/revive` | JSON | Tirarse de la mesa y revivir. Body opcional: `{"reason": "..."}`. Alias: `/api/nahualada`. |

### Errores

| Estado | Cuándo | Cuerpo |
|--------|--------|--------|
| 400 | body JSON inválido en `/api/chat` | `{"reply": "Eso no fue un maullido válido."}` |
| 429 | limitador de golpes excedido | `{"reply": "..."}` con el motivo |
| 500 | excepción no controlada | `{"reply": "Me atraganté con algo. Volvé a intentar. prrrr."}` |
| 404 | ruta desconocida | `{"reply": "Aquí no hay nada. Ni una caja. miau."}` |

## 3. Limitadores de golpes

`limiter(n)` mantiene una ventana deslizante de 60 s por ruta:

| Ruta | Golpes por minuto |
|------|-------------------|
| `/api/chat` | 20 |
| `/api/purr` | 30 |
| `/api/hunt` | 3 |
| `/api/revive` | 3 |

El body de peticiones POST se lee con tope de 64 KiB (`readBody`); si se
excede, la conexión se corta.

## 4. Cabeceras de seguridad

Todas las respuestas JSON y el HTML comparten:

```
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
  script-src 'unsafe-inline'; img-src data:; connect-src 'self';
  form-action 'none'; base-uri 'none'; frame-ancestors 'none'
```

La CSP permite exactamente lo que la página usa: CSS y JS inline (la página
no tiene archivos externos) e imágenes `data:` (el favicon SVG). Ver
[implementación de seguridad](../security/implementation.md).

## 5. Problemas comunes

- El proxy del Sprite puede responder 502 si un handler excede su ventana de
  tiempo (pasa con modelos lentos en `/api/chat`): ver
  [troubleshooting](../deployment/troubleshooting.md).
- `/api/hunt` devuelve `ran: false` con `reason` cuando el monedero no
  autoriza gasto: no es un error, es el gato ayunando.

## Referencias

- [Altar y chat](../features/altar-y-chat.md)
- [Flujos de datos](data-flow.md)
- Archivo fuente: `src/altar-server.ts`
- Página servida: `src/altar.ts`
