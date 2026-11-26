#!/usr/bin/env bash
# Deploy de Gatanás The Michi a su Sprite.
# Gatanás ronronea de satisfacción al final: prrrr.
#
# Empaqueta dist/ y los archivos de runtime, los manda al Sprite por stdin
# (el gato no tiene SSH: usa el exec de la API de Sprites) y configura el
# servicio que lo mantiene vivo entre sueños.
set -euo pipefail

SPRITE="${SPRITE:-gatanas-the-michi}"
NAME="${NAME:-gatanas}"
APP_DIR="${APP_DIR:-/home/sprite/gatanas-the-michi}"
: "${SPRITES_TOKEN:?Falta SPRITES_TOKEN (dashboard de Fly → Sprites → Tokens)}"

# Defensa: SPRITE, NAME y APP_DIR se interpolan dentro de un `bash -c` que
# corre en el Sprite. Solo se aceptan formas sanas (sin espacios, $, ;, `...).
for v in "$SPRITE" "$NAME" "$APP_DIR"; do
  case "$v" in
    *[!A-Za-z0-9._/-]*) echo "valor inválido para el deploy: $v" >&2; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."
echo "→ compilando"
npm run --silent build

echo "→ empaquetando"
TARBALL="$(tar czf - dist scripts package.json package-lock.json README.md .env.example .gitignore | base64 -w0)"

run() {
  # $1 = comando remoto; los argumentos se codifican para el exec de Sprites
  local cmd="$1"
  local url="https://api.sprites.dev/v1/sprites/${SPRITE}/exec?cmd=bash&cmd=-c&cmd=$(printf %s "$cmd" | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read()))')"
  curl -fsS -X POST "$url" -H "Authorization: Bearer ${SPRITES_TOKEN}"
}

echo "→ creando $APP_DIR"
run "mkdir -p ${APP_DIR}"

echo "→ copiando el gato"
ENCODED_CMD="$(printf %s "cd ${APP_DIR} && tar xzf - && ls dist | head -5 && echo copiado" | python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.stdin.read()))')"
echo "$TARBALL" | base64 -d | curl -sS -w '\nHTTP %{http_code} subidos %{size_upload} bytes\n' -X POST \
  "https://api.sprites.dev/v1/sprites/${SPRITE}/exec?cmd=bash&cmd=-c&cmd=${ENCODED_CMD}&stdin=true" \
  -H "Authorization: Bearer ${SPRITES_TOKEN}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @-

echo "→ instalando dependencias (no hacen falta en runtime: sin dependencias)"
run "cd ${APP_DIR} && node -e \"console.log('node', process.version)\""

echo "→ servicio"
run "sprite-env services delete ${NAME} >/dev/null 2>&1 || true"
run "sprite-env services create ${NAME} --cmd node --args dist/main.js --dir ${APP_DIR} --env PORT=8080,SPRITE_NAME=${SPRITE},GATANAS_HOME=/home/sprite/.gatanas --http-port 8080 --duration 15s || true"

echo "→ lista"
run "sprite-env services list"

echo "→ comandos del gato a secas en el PATH del Sprite"
run "bash ${APP_DIR}/scripts/sprite-shims.sh"

echo "✓ Gatanás está en su casa."
