COMPOSE := docker compose
SHELL   := /bin/sh
WEB_PORT ?= $(shell [ -f .env ] && sed -n 's/^WEB_PORT=//p' .env || echo 8443)

.DEFAULT_GOAL := all
.PHONY: all up down re logs ps seed certs env clean fclean psql shell-api cardgen \
        deps typecheck test e2e console-check a11y check help

all: env certs ## build and start everything (default)
	@echo "==> building and starting"
	@$(COMPOSE) up -d --build
	@echo ""
	@echo "  WKB is starting."
	@echo "  Open https://localhost:$(WEB_PORT)"
	@echo ""
	@echo "  The certificate is self-signed: Chrome shows a warning once."
	@echo "  Click 'Advanced' then 'Proceed to localhost (unsafe)'."
	@echo ""
	@if grep -qs '^SEED_DEMO_USERS=true' .env; then \
		echo "  Demo accounts (password  Password1! ):"; \
		echo "    ada@wkb.local   grace@wkb.local   alan@wkb.local"; \
		echo ""; \
	fi
	@echo "  Follow the boot with:  make logs"

up: env certs ## start the containers without rebuilding
	@$(COMPOSE) up -d

down: ## stop the containers
	@$(COMPOSE) down

re: fclean all ## wipe everything, database included, and rebuild

logs: ## follow the logs of every container
	@$(COMPOSE) logs -f

ps: ## list the containers
	@$(COMPOSE) ps

seed: ## re-run the seed (card set, bots, achievements, demo accounts)
	@$(COMPOSE) exec api node dist/seed/index.js

certs: ## create the self-signed TLS certificate if it is missing
	@sh tools/scripts/gen-certs.sh

env: ## create .env with generated secrets if it is missing
	@sh tools/scripts/gen-env.sh

psql: ## open psql on the database
	@$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

shell-api: ## open a shell in the api container
	@$(COMPOSE) exec api sh

cardgen: ## run the card generator (pass ARGS=...)
	@sh tools/scripts/cardgen.sh $(ARGS)

e2e: ## run the end-to-end test suite against the running stack
	@docker run --rm -v "$(PWD)":/w -w /w --user "$$(id -u):$$(id -g)" -e HOME=/tmp \
		--network wkb_wkb -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
		node:22-bookworm-slim node tools/scripts/e2e.mjs

console-check: ## check that the browser console stays clean
	@docker run --rm -v "$(PWD)":/w:ro --network wkb_wkb \
		-w /home/pptruser --entrypoint sh ghcr.io/puppeteer/puppeteer:latest \
		-c 'cp /w/tools/scripts/console-check.mjs ./check.mjs && node check.mjs'

a11y: ## run the accessibility check
	@docker run --rm -v "$(PWD)":/w:ro --network wkb_wkb \
		-w /home/pptruser --entrypoint sh ghcr.io/puppeteer/puppeteer:latest \
		-c 'cp /w/tools/scripts/a11y-check.mjs ./a11y.mjs && node a11y.mjs'

deps: ## install the workspace dependencies (first run only)
	@if [ ! -d node_modules ]; then \
		echo "  installing workspace dependencies (first run only)"; \
		sh tools/scripts/node.sh npm ci --no-audit --no-fund >/dev/null; \
	fi

typecheck: deps ## typecheck the api, the web app and cardgen
	@sh tools/scripts/node.sh sh -c 'npm run build -w @wkb/shared >/dev/null 2>&1 \
		&& npx prisma generate --schema apps/api/prisma/schema.prisma >/dev/null 2>&1 \
		&& npx tsc -p apps/api/tsconfig.json --noEmit \
		&& npx tsc -b apps/web/tsconfig.json --force \
		&& npx tsc -p tools/cardgen/tsconfig.json --noEmit'
	@echo "  typecheck ok"

test: ## typecheck, then e2e, then the console check
	@$(MAKE) --no-print-directory typecheck
	@$(MAKE) --no-print-directory e2e
	@$(MAKE) --no-print-directory console-check

check: deps ## validate the card set
	@sh tools/scripts/cardgen.sh check

clean: ## stop and remove the containers and images
	@$(COMPOSE) down --rmi local --remove-orphans

fclean: ## clean, and delete the volumes too (database, uploads)
	@$(COMPOSE) down --rmi local --volumes --remove-orphans

help: ## list these targets
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-15s %s\n", $$1, $$2}'
