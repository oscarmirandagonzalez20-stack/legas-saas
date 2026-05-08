# ─── Stage 1: Install workspace dependencies ──────────────────────────────────
# Copy only the manifest files first so this layer is cached until lockfile changes.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
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
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /monorepo

# Restore the installed node_modules from the deps stage
COPY --from=deps /monorepo/node_modules            ./node_modules
COPY --from=deps /monorepo/apps/api/node_modules   ./apps/api/node_modules
# Workspace packages (meta-sdk, shared-types, etc.) may have their own node_modules
COPY --from=deps /monorepo/packages                ./packages

# Copy full source
COPY . .

# 1. Regenerate Prisma client for linux-musl (Alpine target)
# 2. Webpack-bundle the API (resolves all @/ and workspace path aliases)
# 3. Create a self-contained deployment directory with flat prod node_modules
RUN pnpm --filter=@legal-saas/api db:generate && \
    pnpm --filter=@legal-saas/api build && \
    pnpm deploy --filter=@legal-saas/api /deploy --prod

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
WORKDIR /app

# Non-root user — mandatory for production containers
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# Copy the deployment snapshot (flat node_modules + package source including dist/)
COPY --from=builder --chown=nestjs:nodejs /deploy ./

# Prisma schema must be present for `prisma migrate deploy` at container startup
COPY --from=builder --chown=nestjs:nodejs /monorepo/apps/api/prisma ./prisma

USER nestjs
EXPOSE 4000

# dumb-init as PID 1: proper signal handling + no zombie processes
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
