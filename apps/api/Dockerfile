# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Prisma sniffs the OpenSSL version when generating the client, so the build
# stage needs it too — otherwise it emits an engine the runtime cannot load.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Manifests first so the dependency layer survives source edits.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tools/cardgen/package.json tools/cardgen/
RUN npm ci --ignore-scripts --no-audit --no-fund && npm rebuild prisma @prisma/engines @prisma/client


COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build -w @wkb/shared && npx --no-install prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @wkb/api

# --- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine links against OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# The server runs unprivileged, and 'prisma migrate deploy' verifies its engine files at startup, 
# so the whole tree has to belong to the runtime user
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/apps/api/uploads \
 && chown -R node:node /app

USER node
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
