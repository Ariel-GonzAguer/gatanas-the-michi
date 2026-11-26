# Feature: auto-publicación del repo

El gato publica su propio código en GitHub desde dentro de su Sprite, por el
conector OAuth de Sprites. El token de GitHub nunca entra a la máquina.

## ¿Qué es y por qué está aquí?

El requisito del hackathon incluye un repo público. Un Sprite no lleva
credenciales de git y así debe seguir: la solución fue usar el conector de
GitHub del gateway de Sprites, que firma las llamadas con el token OAuth del
humano según la identidad del Sprite. El gato comitea su propia historia.

## Cómo funciona (flujo técnico)

```
node dist/github-publish.js  (corre DENTRO del Sprite)
        │
        ├── collectFiles(REPO_ROOT)   recorre el árbol de trabajo
        │     SKIP_DIRS: node_modules, dist, dist-test, .git, .gatanas
        │     SKIP_FILES: package-lock.json; binaries (content incluye \0)
        ▼
gateway/github/<conn>/repos/<repo>/...
        ├── GET  git/ref/heads/main          → head sha
        ├── GET  git/commits/<sha>           → árbol base
        ├── POST git/trees (base_tree)       → árbol nuevo con los archivos
        ├── POST git/commits                 → commit firmado por el gato
        └── PATCH git/refs/heads/main        → mueve la rama (fast-forward)
```

El commit lleva la firma del gato:

```
<message>

— Gatanás The Michi, desde su Sprite
```

## Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/github-publish.ts` | Recolección de archivos, llamadas al gateway, commit y push. |
| `src/habitat.ts` | Convención del gateway (`SPRITES_GATEWAY`) usada por el script. |
| `scripts/deploy.sh` | Sube el árbol de trabajo al Sprite antes de publicar. |

## API / Interfaz pública

```bash
# Uso real (variables requeridas):
GITHUB_CONNECTION=<id> REPO=Ariel-GonzAguer/gatanas-the-michi \
  node dist/github-publish.js [--message "texto del commit"]
```

| Variable | Default | Descripción |
|----------|---------|-------------|
| `GITHUB_CONNECTION` | (requerida) | ID del conector GitHub en el gateway. |
| `REPO` | (requerida) | `owner/name` del repo destino. |
| `REPO_ROOT` | `/home/sprite/gatanas-the-michi` | Árbol de trabajo a publicar. |
| `BRANCH` | `main` | Rama destino. |

El conector debe tener `access_policy` con `sprite_labels` que incluya al
Sprite (mismo esquema que el conector de OpenRouter).

## Dependencias externas

- Gateway de conectores de Sprites → GitHub (API REST v3, Git Data API y
  Contents API). Sin dependencias de npm.

## Limitaciones y consideraciones

- **Repo vacío**: la Git Data API falla con 409 `"Git Repository is empty"`
  en un repo sin commits. La salida es crear el primer archivo con
  `PUT /contents/<path>` (crea la rama `main`) y recién después usar el
  flujo de árboles. Ver [troubleshooting](../deployment/troubleshooting.md).
- **Publica el árbol de trabajo, no el estado del repo**: si en el Sprite
  quedan archivos que no querés publicar, hay que borrarlos del árbol ANTES
  de publicar; `base_tree` fusiona, no reemplaza, así que un archivo
  borrado solo del repo reaparece en la próxima publicación.
- No borra archivos que existen en el repo pero no en el árbol de trabajo:
  es una publicación aditiva (útil para no destruir historia, peligroso si
  se espera un espejo exacto).

## Referencias

- [Deployment en Sprites](../deployment/platform.md)
- [Seguridad](../security/implementation.md) (el token nunca entra al Sprite)
- [Troubleshooting](../deployment/troubleshooting.md) (repo vacío, archivos reaparecidos)
- Archivo fuente: `src/github-publish.ts`
