#!/usr/bin/env bash
# Builds the public static site (dist-site/) for GitHub Pages at lionheartscholars.org from the prototype.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/.."
bash scripts/build-prototype.sh prototype/dist/body.html >/dev/null
python3 - <<'PY'
import os
body = open('prototype/dist/body.html').read()
title_end = body.index('</title>') + len('</title>')
title, rest = body[:title_end], body[title_end:]
rest = rest.replace('<meta name="claude:viewport-fit-sides" content="cover">', '')
fav = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23fbf8f1' stroke='%231c2a4a' stroke-width='3'/%3E%3Ccircle cx='32' cy='32' r='25' fill='none' stroke='%23b9975b' stroke-width='1.5'/%3E%3Ctext x='32' y='43' font-family='Georgia,serif' font-size='30' text-anchor='middle' fill='%238e2a2e'%3EL%3C/text%3E%3C/svg%3E"
head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{title}
<meta name="description" content="Lionheart is a Tennessee scholarship granting organization. Give up to $1,700 each ($3,400 as a couple) and claim it back as a federal tax credit; it becomes tuition at a Tennessee Christian school.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#1c2a4a">
<link rel="icon" href="{fav}">
'''
i = rest.index('<style>'); j = rest.index('</style>') + len('</style>')
html = head + rest[i:j] + '\n</head>\n<body>\n' + rest[:i] + rest[j:] + '\n</body>\n</html>\n'
os.makedirs('dist-site', exist_ok=True)
open('dist-site/index.html', 'w').write(html)
open('dist-site/CNAME', 'w').write('lionheartscholars.org\n')
open('dist-site/.nojekyll', 'w').write('')
open('dist-site/404.html', 'w').write(html)
print('dist-site/index.html', len(html))
PY
