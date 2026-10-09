#!/bin/sh
# Subset Noto Sans SC Black for the masthead; keep the full font outside the app.
# Usage: tools/display-font.sh <NotoSansSC[wght].ttf> <path-to-pyftsubset>
set -eu
SRC="$1"
SUBSET="${2:-pyftsubset}"
"$SUBSET" "$SRC" --text='像素填色!' --flavor=woff2 --output-file=assets/display.woff2
"$SUBSET" "$SRC" --text='像素填色!' --flavor=woff --output-file=/tmp/colorbook-display.woff
B64=$(base64 < /tmp/colorbook-display.woff | tr -d '\n')
printf '/* Noto Sans SC, SIL OFL; see assets/display-OFL.txt */\n@font-face { font-family: "cb-display"; font-weight: 100 900; src: url("data:font/woff;base64,%s") format("woff"); }\n' "$B64" > mp/display.wxss
