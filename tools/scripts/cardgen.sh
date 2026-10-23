#!/usr/bin/env sh
# Runs the card pipeline in the pinned Node image, so it needs no local Node.
#   make cardgen ARGS="check"
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Allocate a TTY only when there is one to allocate: `docker run -it` fails
# outright when stdout is a pipe, which is how `make check` gets invoked in a
# script or a CI job.
TTY_FLAGS=""
[ -t 0 ] && [ -t 1 ] && TTY_FLAGS="-it"

# shellcheck disable=SC2086
docker run --rm $TTY_FLAGS \
  -v "$ROOT":/w -w /w/tools/cardgen \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  node:22-bookworm-slim \
  sh -c 'npx tsc -p tsconfig.json && node dist/cli.js '"$*"
