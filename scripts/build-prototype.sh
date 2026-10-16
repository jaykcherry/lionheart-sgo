#!/usr/bin/env bash
# Assembles the single-file prototype: site.html + theme.css + Archivo (inlined) + engine (bundled from src/domain) + portals.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/.."
./node_modules/.bin/esbuild src/domain/index.ts --bundle --format=iife --global-name=LionheartEngine --target=es2019 --outfile=prototype/engine.js --log-level=warning
python3 - "$@" <<'PY'
import sys, base64, os
site = open('prototype/site.html').read()
font = base64.b64encode(open('prototype/archivo-wdth.woff2', 'rb').read()).decode()
face = ('@font-face { font-family: "Archivo"; font-style: normal; font-weight: 100 900; font-stretch: 62% 125%; font-display: swap; '
        f'src: url(data:font/woff2;base64,{font}) format("woff2-variations"), url(data:font/woff2;base64,{font}) format("woff2"); }}')
site = site.replace('/*__FONT__*/', face).replace('/*__THEME__*/', open('prototype/theme.css').read())
engine = open('prototype/engine.js').read(); portals = open('prototype/portals.js').read()
inject = '<script>\n' + engine + '\nwindow.LionheartEngine = LionheartEngine;\n</script>\n<script>\n' + portals + '\n</script>\n'
i = site.index('<script>\n(function () {')
out = site[:i] + inject + site[i:]
dest = sys.argv[1] if len(sys.argv) > 1 else 'prototype/dist/lionheart.html'
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w').write(out)
print('wrote', dest, len(out), 'bytes')
PY
