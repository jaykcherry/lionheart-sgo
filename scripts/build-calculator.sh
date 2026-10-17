#!/usr/bin/env bash
# Builds the internal award calculator: tools/award-calculator/src.html + the bundled domain engine → dist.
set -euo pipefail
cd "$(dirname "$0")/.."
./node_modules/.bin/esbuild src/domain/index.ts --bundle --format=iife --global-name=LionheartEngine --target=es2019 --outfile=prototype/engine.js --log-level=warning
mkdir -p tools/award-calculator/dist
python3 - <<'PY'
src = open('tools/award-calculator/src.html').read()
eng = open('prototype/engine.js').read()
assert '</script' not in eng.lower()
out = src.replace('/*ENGINE*/', eng + '\nwindow.LionheartEngine = LionheartEngine;')
open('tools/award-calculator/dist/award-calculator.html', 'w').write(out)
print('wrote tools/award-calculator/dist/award-calculator.html', len(out), 'bytes')
PY
