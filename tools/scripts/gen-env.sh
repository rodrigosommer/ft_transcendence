#!/usr/bin/env sh
# Creates .env from .env.example with freshly generated secrets.
# Never overwrites an existing .env.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  echo "  .env already exists, leaving it untouched"
  exit 0
fi

# Through the wrapper: an installed openssl is not always one that runs.
ssl() { sh "$ROOT/tools/scripts/openssl.sh" "$@"; }

if ! ssl version >/dev/null; then
  echo "  no usable openssl; copying .env.example verbatim." >&2
  echo "  Replace every 'replace_with_*' and 'change_me_*' value by hand." >&2
  cp .env.example .env
  exit 0
fi

ACCESS_SECRET="$(ssl rand -hex 48)"
REFRESH_SECRET="$(ssl rand -hex 48)"
# Restricted alphabet: the password is interpolated into a DATABASE_URL.
DB_PASSWORD="$(ssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-32)"

sed \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${ACCESS_SECRET}|" \
  -e "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${REFRESH_SECRET}|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASSWORD}|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://wkb:${DB_PASSWORD}@postgres:5432/wkb?schema=public|" \
  .env.example > .env

chmod 600 .env
echo "  .env created with generated secrets"
