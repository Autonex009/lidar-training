#!/bin/sh
# Container entrypoint: migrate, generate demo assets once, seed idempotently, start.
set -e
mkdir -p "${ASSETS_DIR:-/data/assets}"
npx prisma migrate deploy
if [ ! -d "${ASSETS_DIR:-/data/assets}/demo-nav" ]; then
  npm run assets:generate
fi
npx prisma db seed
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
