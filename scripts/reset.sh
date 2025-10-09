#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning caches & generated data"
rm -rf node_modules package-lock.json \
       .cache .mfscan-cache .tmp dist \
       logs/* data/*

mkdir -p data logs

echo "==> Fresh install"
npm install

echo "==> Sanity check"
node index.js --help || true

echo "Done. Next typical run:"
echo "  node index.js scan --all"
