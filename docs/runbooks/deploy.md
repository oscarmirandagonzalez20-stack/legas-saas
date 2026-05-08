# Runbook: Deploy

**Owner:** Engineering  
**Last updated:** 2026-05-08  
**Applies to:** Staging and Production environments on Railway (API) + Vercel (web)

---

## Architecture overview

| Service | Platform | Trigger |
|---------|----------|---------|
| `apps/api` | Railway | GitHub push to `main` → auto-deploy to staging |
| `apps/web` | Vercel | GitHub push to `main` → auto-deploy to preview/production |
| PostgreSQL | Railway managed | Provisioned once — no deploy action |
| Redis | Railway managed | Provisioned once — no deploy action |

---

## First-time Railway setup

**Do this once per environment (staging / production).**

### 1. Create Railway project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

### 2. Add managed services

In the Railway dashboard for your project:
1. **New Service → Database → PostgreSQL** — Railway creates `DATABASE_URL` automatically.
2. **New Service → Database → Redis** — Railway creates `REDIS_URL` automatically.
3. **New Service → GitHub Repo** — select this repo, set root directory to `/` (uses `apps/api/railway.toml`).

### 3. Configure environment variables

Set these in Railway → Your Service → Variables. Use `.env.production.example` as the reference:

```
NODE_ENV=production
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_REDIRECT_URI=https://api.yourdomain.com/meta/oauth/callback
ENCRYPTION_KEY=          # openssl rand -hex 32
CLERK_SECRET_KEY=
FRONTEND_URL=https://app.yourdomain.com
SENTRY_DSN=              # optional
SENTRY_ENVIRONMENT=production
```

> Railway auto-injects `DATABASE_URL` and `REDIS_URL` from the managed plugins — do NOT set these manually.

> **`DATABASE_URL_DIRECT` — acción requerida:** Railway Postgres no usa PgBouncer, así que esta variable debe ser el mismo valor que `DATABASE_URL`. Cópiala manualmente: Railway Variables → copia el valor de `DATABASE_URL` → crea `DATABASE_URL_DIRECT` con el mismo valor. Sin esta variable, Prisma falla al arrancar.

### 4. Custom domain

In Railway → Your Service → Settings → Networking:
1. Add custom domain: `api.yourdomain.com`
2. Copy the CNAME value Railway provides
3. Add the CNAME record in your DNS provider
4. Railway provisions SSL automatically (Let's Encrypt)

### 5. Verify

```bash
./scripts/smoke-test.sh https://api.yourdomain.com
```

---

## Staging → Production promotion

**Staging deploys automatically on push to `main`.  
Production requires manual promotion.**

### Option A: Railway Dashboard (recommended)
1. Open Railway → your project → production environment
2. Click **Deploy** → select the staging deployment you want to promote
3. Confirm promotion
4. Wait for health check to pass (Railway checks `/health/live`)
5. Run smoke test: `./scripts/smoke-test.sh https://api.yourdomain.com`

### Option B: Railway CLI
```bash
railway up --service legal-saas-api --environment production
```

---

## Routine deploy checklist

Before promoting staging → production:

- [ ] CI is green on the commit you're deploying (`quality` + `build` + `audit` jobs)
- [ ] Postgres extensions verified (vector, pgcrypto, uuid-ossp, pg_trgm) — first deploy only
- [ ] `db:migrate:deploy` applied to staging first, no errors
- [ ] Staging smoke test passes: `./scripts/smoke-test.sh https://staging-api.yourdomain.com`
- [ ] No pending Prisma migrations that haven't been applied to staging first
- [ ] ENCRYPTION_KEY has not changed (changing it invalidates all stored tokens)
- [ ] New env vars required by the deploy are pre-set in Railway production variables
- [ ] Sentry has no new unresolved critical alerts from staging run

---

## Database migrations

### Paso 0 — Habilitar extensiones (solo primera vez, antes del primer migrate)

Railway Postgres incluye `pgcrypto` y `uuid-ossp` por defecto, pero **`vector` (pgvector) y `pg_trgm` pueden no estar habilitadas**. Si no existen, el primer `migrate deploy` falla con `extension "vector" does not exist`.

Ejecutar en Railway → Postgres service → **Query** tab antes del primer migrate:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Verificar que las 4 se crean sin error antes de continuar.

### Paso 1 — Aplicar migraciones

```bash
# Staging
railway run --environment staging pnpm db:migrate:deploy

# Production (después de validar en staging)
railway run --environment production pnpm db:migrate:deploy
```

### Paso 2 — Seed demo (staging únicamente)

```bash
railway run --environment staging pnpm db:seed
```

> Migrations run with `prisma migrate deploy` (not `migrate dev`).
> **Never** run `prisma migrate dev` against a production database.
> **Never** run `pnpm db:seed` against production — seed data is for staging/demo only.

---

## Vercel (web) deploy

The web app deploys automatically to Vercel on every push to `main`.

1. Connect repo in Vercel dashboard → set root directory to `apps/web`
2. Set environment variables (see `apps/web/.env.production.example`)
3. Vercel builds with `pnpm build:web` and deploys to the CDN edge

Vercel preview deploys are created for every PR automatically.
