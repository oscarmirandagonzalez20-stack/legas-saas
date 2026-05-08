-- Rollback: 20260507020800_add_tenant_id_to_messages
DROP INDEX IF EXISTS "social_accounts_tenant_id_status_idx";
DROP INDEX IF EXISTS "posts_tenant_id_social_account_id_posted_at_idx";
DROP INDEX IF EXISTS "messages_tenant_id_conversation_id_created_at_idx";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_tenant_id_fkey";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "tenant_id";
