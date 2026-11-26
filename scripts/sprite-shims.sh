#!/usr/bin/env bash
# Deja los comandos del gato a secas en la terminal del Sprite.
#
# Uso (dentro del Sprite):  bash scripts/sprite-shims.sh
# Después, en cualquier shell del Sprite funcionan:
#   gatanas altar · hunt · lives · meow "texto" · revive
# y también a secas:        altar · hunt · lives · meow · revive
set -euo pipefail

DIR="${GATANAS_DIR:-/home/sprite/gatanas-the-michi}"
BIN="${GATANAS_BIN:-/usr/local/bin}"
# Defensa: estos valores terminan interpolados dentro de los shims y en rutas
# de sistema. Solo se aceptan formas sanas, sin espacios ni metacaracteres.
case "$DIR" in
  /home/sprite/*|/data/*) : ;;
  *) echo "GATANAS_DIR debe vivir bajo /home/sprite o /data (recibido: $DIR)" >&2; exit 1 ;;
esac
case "$BIN" in
  /usr/local/bin|/home/sprite/.local/bin) : ;;
  *) echo "GATANAS_BIN solo puede ser /usr/local/bin o /home/sprite/.local/bin (recibido: $BIN)" >&2; exit 1 ;;
esac
SUDO=""
[ -w "$BIN" ] || SUDO="sudo"

$SUDO tee "$BIN/gatanas" >/dev/null <<EOF
#!/bin/sh
exec node $DIR/dist/cli.js "\$@"
EOF

for cmd in hunt altar guarida lives meow churus revive nahualada; do
  $SUDO tee "$BIN/$cmd" >/dev/null <<EOF
#!/bin/sh
exec gatanas $cmd "\$@"
EOF
done

$SUDO chmod 755 "$BIN/gatanas" "$BIN/hunt" "$BIN/altar" "$BIN/guarida" "$BIN/lives" "$BIN/meow" "$BIN/churus" "$BIN/revive" "$BIN/nahualada"
echo "listo: gatanas, hunt, altar/guarida, lives, meow, churus, revive (alias nahualada)"
