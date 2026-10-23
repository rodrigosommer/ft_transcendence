#!/usr/bin/env sh
# Runs a command inside the pinned Node image, as the calling user, so nothing
# in the working tree ends up owned by root.
exec docker run --rm -i \
  -v "$(cd "$(dirname "$0")/../.." && pwd)":/w -w /w \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  node:22-bookworm-slim "$@"
