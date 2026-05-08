-- AddColumn: tenant_id to messages (nullable first, then backfill, then NOT NULL)
ALTER TABLE "messages" ADD COLUMN "tenant_id" UUID;

-- Backfill: messages inherit tenant from their conversation (FK is NOT NULL, always set)
UPDATE "messages" m
SET "tenant_id" = c."tenant_id"
FROM "conversations" c
WHERE m."conversation_id" = c."id";

-- SetNotNull: safe after backfill; every message now has a tenant_id
ALTER TABLE "messages" ALTER COLUMN "tenant_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: tenant-scoped message queries (replaces need for subquery in RLS)
CREATE INDEX "messages_tenant_id_conversation_id_created_at_idx"
  ON "messages"("tenant_id", "conversation_id", "created_at");

-- CreateIndex: feed display per social account
CREATE INDEX "posts_tenant_id_social_account_id_posted_at_idx"
  ON "posts"("tenant_id", "social_account_id", "posted_at");

-- CreateIndex: active account filter
CREATE INDEX "social_accounts_tenant_id_status_idx"
  ON "social_accounts"("tenant_id", "status");
