# Runbook: Rollback

**Owner:** Engineering  
**Last updated:** 2026-05-08  
**Use when:** A production deploy introduced a regression and the fix cannot be shipped within 15 minutes.

---

## Decision tree

```
Production is broken
       │
       ▼
Can you ship a hotfix in < 15 min?
       │
   Yes │            No
       │             │
       ▼             ▼
  Ship hotfix    Roll back to
  via staging    previous deploy
```

---

## API rollback (Railway)

### Via Railway Dashboard (fastest)

1. Open [railway.app](https://railway.app) → your project → **Production** environment
2. Click your API service → **Deployments** tab
3. Find the last known-good deployment (look for the green checkmark)
4. Click **Redeploy** on that deployment
5. Railway will re-deploy the previous Docker image — no rebuild needed
6. Monitor health: Railway shows the health check status in real time

**Expected time to recovery: 2–4 minutes** (Railway reuses cached image)

### Via Railway CLI

```bash
# List recent deployments
railway deployments list --environment production

# Redeploy a specific deployment by ID
railway deployments redeploy <deployment-id> --environment production
```

### Verify after rollback

```bash
./scripts/smoke-test.sh https://api.yourdomain.com
```

Both checks must pass:
- `GET /health/live` → HTTP 200
- `GET /health/ready` → HTTP 200, body contains `"status":"ok"`

---

## Web rollback (Vercel)

1. Open [vercel.com](https://vercel.com) → your project
2. **Deployments** tab → find the last successful production deployment
3. Click **...** → **Promote to Production**
4. Vercel instantly routes traffic to the previous build (atomic swap, ~30 seconds)

---

## Database rollback

> **Railway managed Postgres does NOT support instant rollback.**

If a migration caused data corruption:

1. **Do NOT attempt to reverse a migration manually in production.**
2. Identify the last clean backup in Railway → your Postgres service → **Backups**
3. Contact Railway support to restore to a point-in-time before the bad migration
4. RPO: up to 24 hours (Railway daily backups). For finer granularity, see [backup-recovery.md](./backup-recovery.md)

For schema-only rollbacks (no data loss), you can create and apply a new migration that reverts the schema change:

```bash
# Create a revert migration locally
pnpm db:migrate:create --name revert_<description>
# Edit the generated SQL
# Apply to production
railway run --environment production pnpm db:migrate:deploy
```

---

## Post-rollback actions

After rolling back:

1. Create a post-mortem issue in the project tracker describing what broke and why
2. Keep the broken deploy available for debugging (don't delete it from Railway)
3. Fix the issue in a branch, validate in staging, then re-promote
4. Update this runbook if the incident revealed a gap in the process
