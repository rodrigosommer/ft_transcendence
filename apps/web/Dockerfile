# syntax=docker/dockerfile:1

# build
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY tools/cardgen/package.json tools/cardgen/
RUN npm ci --ignore-scripts --no-audit --no-fund && npm rebuild esbuild

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build -w @wkb/shared && npm run build -w @wkb/web

# runtime: the unprivileged image runs nginx as a non-root user
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80