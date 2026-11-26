# Seguridad — implementación

El agente corre expuesto en una URL pública y habla con dos conectores que
guardan secretos ajenos. La implementación minimiza superficie: cero
dependencias, cero CDNs, secretos fuera del proceso.

## 1. Resumen

Tres frentes: el perímetro HTTP (cabeceras, limitadores, escaping), la
superficie del chat (lo que el modelo puede hacer) y la custodia de
credenciales (BYOK por conectores, `SPRITES_TOKEN` opcional).

## 2. Perímetro HTTP

| Control | Implementación | Ubicación |
|---------|----------------|-----------|
| CSP estricta | `default-src 'none'` + inline permitido solo para lo que la página usa | `SECURITY_HEADERS` en `altar-server.ts` |
| Anti-clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | ídem |
| Anti-MIME | `X-Content-Type-Options: nosniff` | ídem |
| Referrer | `Referrer-Policy: no-referrer` | ídem |
| Rate limiting | ventana de 60 s por ruta (chat 20, purr 30, hunt 3, revive 3) | `limiter()` |
| Body limit | 64 KiB en POST; exceder corta la conexión | `readBody()` |
| Entrada al modelo | mensaje recortado a 1200 chars | `speak()` / handler |
| Robots | `Disallow: /api/` | `GET /robots.txt` |

El escape de salida: TODO texto dinámico del HTML (narraciones del modelo,
títulos de presas, opinión) pasa por `esc()` en `altar.ts`. `test/altar.test.ts`
inyecta `<script>alert(1)</script>` y `<img src=x onerror=...>` como
narración y verifica que llegan escapados al HTML. El JS de la página usa
`textContent` (nunca `innerHTML`) para pintar el hilo de chat.

## 3. Custodia de credenciales

```
┌────────────┐  identidad del Sprite   ┌─────────────────────┐
│  Proceso    │───────────────────────→│  Gateway de Sprites │
│  (gato)     │   nunca ve la key      │  - OpenRouter (BYOK)│
└────────────┘                        │  - GitHub (OAuth)    │
                                      └─────────────────────┘
```

- La API key de OpenRouter vive en el conector del gateway: el proceso la
  usa indirectamente y nunca la lee. `access_policy.sprite_labels`
  restringe cada conector a Sprites con el label `gatanas`.
- El token OAuth de GitHub queda del lado del gateway; el gato hace
  llamadas firmadas sin poseerlo (ver
  [auto-publicación](../features/auto-publicacion-github.md)).
- `SPRITES_TOKEN` (plano de control: checkpoints, servicios, exec) es
  opcional y solo se pasa como variable de entorno del servicio. Sin él, el
  agente pierde vidas y reinicios, no observabilidad ni altar.

## 4. Lo que el modelo puede y no puede hacer

| Riesgo | Mitigación |
|--------|------------|
| Inflar severidad de hallazgos | La clasificación es heurística pura (`diet.ts`); el modelo solo redacta |
| Inyectar HTML desde la narración | `esc()` + test de inyección + `textContent` en el cliente |
| Prompt injection desde el chat | El mensaje viaja como dato de un único turno; no hay tools ni ejecución de acciones desde el chat |
| Gasto descontrolado | Monedero con tope diario y tope de llave (ver [monedero](../features/monedero.md)) |
| DoS por tokens | Limitadores por ruta + `GATANAS_DAILY_TOKEN_BUDGET` |

El gato no ejecuta acciones pedidas por chat: no hay tools, no hay shell
desde conversación. Reiniciar servicios o morir requiere las rutas
dedicadas, que están limitadas y (en el caso de vidas) protegidas por
`SPRITES_TOKEN`.

## 5. Problemas comunes

- La URL pública del Sprite se configuró `auth: public` para que el altar
  sea visible en la demo: es una decisión consciente de este proyecto, no un
  olvido. Si se quiere restringir, se cambia `url_settings.auth` en el
  plano de control.
- El exec de la API de Sprites (usado por `scripts/deploy.sh`) requiere el
  token del plano de control: nunca se sube al repo ni al Sprite.

## Referencias

- [HTTP API](../architecture/routing.md) (cabeceras y limitadores por ruta)
- [Altar y chat](../features/altar-y-chat.md) (escaping del hilo)
- [Auto-publicación](../features/auto-publicacion-github.md)
- Archivo fuente: `src/altar-server.ts`, `src/altar.ts`
