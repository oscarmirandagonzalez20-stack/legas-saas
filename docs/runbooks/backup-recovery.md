# Runbook: Backup & Recovery

**Owner:** Engineering  
**Last updated:** 2026-05-08  
**Applies to:** Production environment on Railway

---

## What data we protect

| Data | Location | Criticality | Owned by |
|------|----------|-------------|---------- |
| Lead/tenant data | Railway Postgres | **Critical** | Railway managed backups |
| Meta access tokens | Railway Postgres (encrypted) | **Critical** | Railway managed backups |
| BullMQ job queue | Railway Redis | Low | Ephemeral — failed jobs survive in DLQ |
| Application code | GitHub | **Critical** | Git history |
| Encryption key | Railway Variables | **Critical** | Manual backup required |

---

## Recovery Point Objective (RPO) / Recovery Time Objective (RTO)

| Scenario | RPO | RTO |
|----------|-----|-----|
| Accidental data deletion | Up to 24 hours | 2–4 hours (restore + verify) |
| Corrupt migration | Up to 24 hours | 4–8 hours (restore + re-migrate) |
| Total infrastructure loss | Up to 24 hours | 4–8 hours (re-provision Railway) |

> **Note:** Railway's managed Postgres provides daily automated backups with 7-day retention on Pro plans. For lower RPO, consider enabling continuous WAL archiving or upgrading to Railway's higher-tier backup options.

---

## Postgres backup strategy

### Automated (Railway managed)

Railway automatically takes daily snapshots of the managed Postgres database.

To verify backups are running:
1. Railway dashboard → your Postgres service → **Backups** tab
2. Confirm the latest backup timestamp is within the last 24 hours

### Manual backup (on-demand)

Take a manual backup before any risky migration:

```bash
# Using Railway CLI with DATABASE_URL from production
railway run --environment production pg_dump $DATABASE_URL \
  --format=custom \
  --no-acl \
  --no-owner \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"
```

Store the `.dump` file in a secure location (e.g., encrypted S3 bucket or 1Password).

---

## Restore procedure

### From Railway managed backup

1. Railway dashboard → Postgres service → **Backups**
2. Select the backup to restore from
3. Click **Restore** — Railway creates a new Postgres instance from the backup
4. Update `DATABASE_URL` in your Railway service variables to point to the restored instance
5. Run `pnpm db:migrate:deploy` to apply any migrations newer than the backup
6. Verify with smoke test: `./scripts/smoke-test.sh https://api.yourdomain.com`

### From manual `.dump` file

```bash
# Restore to a Postgres instance (DATABASE_URL_TARGET is the target)
pg_restore \
  --dbname=$DATABASE_URL_TARGET \
  --no-acl \
  --no-owner \
  backup_YYYYMMDD_HHMMSS.dump
```

---

## Redis (BullMQ queue)

Redis is **not backed up**. This is intentional:

- BullMQ `failed` jobs are persisted in the Redis failed set until retried or cleaned up
- BullMQ `completed` jobs are ephemeral — they are not the system of record (Postgres is)
- In case of total Redis loss: all in-flight jobs are lost, but:
  - No lead data is lost (Postgres is the source of truth)
  - Webhooks that were not yet processed will be retried by Meta (Meta retries for up to 72 hours)
  - The system will self-heal as new webhooks arrive

**Action on Redis loss:** Reconnect the Railway Redis plugin, restart the API service. No data recovery needed.

---

## Encryption key

The `ENCRYPTION_KEY` (AES-256-GCM, 64 hex chars) encrypts all Meta access tokens at rest.

**If the encryption key is lost:**
- All stored Meta access tokens become unrecoverable
- Users will need to re-authorize their Facebook/Instagram accounts via the OAuth flow
- Lead and conversation data remains intact (not encrypted with this key)

**Backup procedure:**
1. Store the encryption key in a password manager (1Password, Bitwarden) shared with at least 2 team members
2. Store a second copy in a secure offline location (printed, safe deposit box)
3. Verify the backup is readable before each production deployment

**Key rotation procedure** (if key is compromised):
1. Generate a new key: `openssl rand -hex 32`
2. Write a migration script that re-encrypts all `social_accounts.access_token_encrypted` values
3. Deploy the migration script in a maintenance window
4. Update `ENCRYPTION_KEY` in Railway Variables
5. Restart the API service

---

## Backup verification checklist (monthly)

Run this checklist on the first Monday of each month:

- [ ] Railway Postgres backups tab shows a backup within the last 24 hours
- [ ] Manual test restore: restore latest backup to a temporary Railway Postgres instance, verify row counts match production
- [ ] Encryption key backup is accessible and readable (verify with a team member)
- [ ] Smoke test against production: `./scripts/smoke-test.sh https://api.yourdomain.com`
- [ ] Delete the temporary test restore instance after verification
