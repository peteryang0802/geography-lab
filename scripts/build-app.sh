#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
npm exec --yes --package=esbuild@0.28.2 -c 'node scripts/build-app.mjs "$(command -v esbuild)"'
