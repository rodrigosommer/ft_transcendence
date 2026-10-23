#!/bin/sh
# Applies migrations and loads the card set before the server accepts traffic
# Both steps are idempotent. Therefore a restart is always safe.
set -e

echo "[entrypoint] applying migrations"
npx --no-install prisma migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] seeding reference data (idempotent)"
node dist/seed/index.js

echo "[entrypoint] starting api"
exec "$@"
