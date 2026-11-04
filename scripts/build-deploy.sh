#!/usr/bin/env bash
# Builds a ready-to-upload archive for shared hosting (no Composer needed on the server).
# Usage: scripts/build-deploy.sh [--with-import]
#   --with-import  also include storage/app/import/*.json (client history; never commit these)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy"; STAGE="$OUT/stage"
rm -rf "$STAGE"; mkdir -p "$STAGE"
rsync -a --exclude .git --exclude node_modules --exclude deploy --exclude tests --exclude .env \
  --exclude 'storage/logs/*.log' --exclude 'storage/framework/sessions/*' --exclude 'storage/framework/cache/data/*' \
  --exclude 'storage/framework/views/*.php' --exclude 'storage/app/private/*' --exclude 'storage/app/import/*.json' \
  "$ROOT/" "$STAGE/"
if [[ "${1:-}" == "--with-import" ]]; then cp "$ROOT"/storage/app/import/*.json "$STAGE/storage/app/import/" 2>/dev/null || true; fi
(cd "$STAGE" && composer install --no-dev --optimize-autoloader --no-interaction --quiet)
mkdir -p "$STAGE/storage/app/private" "$STAGE/storage/framework/"{sessions,cache/data,views} "$STAGE/storage/logs"
(cd "$STAGE" && zip -qr "$OUT/mfd-books.zip" . -x '.env')
echo "Built $OUT/mfd-books.zip"
