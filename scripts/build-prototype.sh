#!/usr/bin/env bash
# Assembles the single-file prototype: site.html + engine (bundled from src/domain) + portals.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/.."
./node_modules/.bin/esbuild src/domain/index.ts --bundle --format=iife --global-name=LionheartEngine --target=es2019 --outfile=prototype/engine.js --log-level=warning
python3 - "$@" <<'PY'
import sys
site=open('prototype/site.html').read()
engine=open('prototype/engine.js').read()
portals=open('prototype/portals.js').read()
inject='<script>\n'+engine+'\nwindow.LionheartEngine = LionheartEngine;\n</script>\n<script>\n'+portals+'\n</script>\n'
i=site.index('<script>\n(function () {')
out=site[:i]+inject+site[i:]
dest=sys.argv[1] if len(sys.argv)>1 else 'prototype/dist/lionheart.html'
import os; os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest,'w').write(out)
print('wrote', dest, len(out), 'bytes')
PY
