#!/usr/bin/env bash
# Assembles the single-file prototype: site.html + theme.css + fonts (inlined) + engine (bundled from src/domain) + motion + portals.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/.."
./node_modules/.bin/esbuild src/domain/index.ts --bundle --format=iife --global-name=LionheartEngine --target=es2019 --outfile=prototype/engine.js --log-level=warning
python3 - "$@" <<'PY'
import sys, base64, os
site = open('prototype/site.html').read()
def face(family, file, weight='400', style='normal'):
    b = base64.b64encode(open('prototype/fonts/' + file, 'rb').read()).decode()
    return f'@font-face {{ font-family: "{family}"; font-style: {style}; font-weight: {weight}; font-display: swap; src: url(data:font/woff2;base64,{b}) format("woff2"); }}'
faces = '\n'.join([
    face('Libre Caslon Display', 'caslon-display.woff2'),
    face('Libre Caslon Text', 'caslon-text-400.woff2'),
    face('Libre Caslon Text', 'caslon-text-400i.woff2', style='italic'),
    face('Libre Caslon Text', 'caslon-text-700.woff2', weight='700'),
    face('Libre Franklin', 'franklin.woff2', weight='100 900'),
])
site = site.replace('/*__FONT__*/', faces).replace('/*__THEME__*/', open('prototype/theme.css').read())
engine = open('prototype/engine.js').read(); portals = open('prototype/portals.js').read(); motion = open('prototype/motion.js').read()
inject = '<script>\n' + engine + '\nwindow.LionheartEngine = LionheartEngine;\n</script>\n<script>\n' + motion + '\n</script>\n<script>\n' + portals + '\n</script>\n'
i = site.index('<script>\n(function () {')
out = site[:i] + inject + site[i:]
dest = sys.argv[1] if len(sys.argv) > 1 else 'prototype/dist/lionheart.html'
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w').write(out)
print('wrote', dest, len(out), 'bytes')
PY
