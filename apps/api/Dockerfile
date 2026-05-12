# ─── Stage 1: Install workspace dependencies ──────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.12.0
# Disable corepack strict mode so it never intercepts the npm-installed pnpm
ENV COREPACK_ENABLE_STRICT=0
WORKDIR /monorepo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json                     ./apps/api/
COPY packages/eslint-config/package.json       ./packages/eslint-config/
COPY packages/meta-sdk/package.json            ./packages/meta-sdk/
COPY packages/shared-types/package.json        ./packages/shared-types/
COPY packages/tsconfig-config/package.json     ./packages/tsconfig-config/
COPY packages/ui/package.json                  ./packages/ui/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@9.12.0
ENV COREPACK_ENABLE_STRICT=0
WORKDIR /monorepo

# Restore installed node_modules from deps stage
COPY --from=deps /monorepo/node_modules            ./node_modules
COPY --from=deps /monorepo/apps/api/node_modules   ./apps/api/node_modules
COPY --from=deps /monorepo/packages                ./packages

# Copy full monorepo source
COPY . .

# 1. Regenerate Prisma client for linux-musl-openssl-3.0.x (Alpine target)
# 2. Webpack-bundle the API
# 3. pnpm deploy creates a self-contained /deploy with flat prod node_modules
RUN pnpm --filter=@legal-saas/api db:generate && \
    pnpm --filter=@legal-saas/api build && \
    pnpm deploy --filter=@legal-saas/api /deploy --prod

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# Self-contained deployment snapshot (flat node_modules + dist/)
COPY --from=builder --chown=nestjs:nodejs /deploy ./

# Prisma schema required by `node node_modules/.bin/prisma migrate deploy`
# which Railway runs via the predeploy hook in railway.toml before traffic
# is routed to this container.
COPY --from=builder --chown=nestjs:nodejs /monorepo/apps/api/prisma ./prisma

# Startup script: execs node directly — migrations are handled by predeploy.
COPY --chown=nestjs:nodejs apps/api/start.sh ./start.sh
RUN chmod +x ./start.sh

USER nestjs
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]
