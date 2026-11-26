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
SUDO=""
[ -w "$BIN" ] || SUDO="sudo"

$SUDO tee "$BIN/gatanas" >/dev/null <<EOF
#!/bin/sh
exec node $DIR/dist/cli.js "\$@"
EOF

for cmd in hunt altar lives meow revive nahualada; do
  $SUDO tee "$BIN/$cmd" >/dev/null <<EOF
#!/bin/sh
exec gatanas $cmd "\$@"
EOF
done

$SUDO chmod 755 "$BIN/gatanas" "$BIN/hunt" "$BIN/altar" "$BIN/lives" "$BIN/meow" "$BIN/revive" "$BIN/nahualada"
echo "listo: gatanas, hunt, altar, lives, meow, revive (alias nahualada)"
