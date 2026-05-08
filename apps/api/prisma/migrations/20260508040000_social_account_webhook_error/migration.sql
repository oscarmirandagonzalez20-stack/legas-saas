-- Sprint 5: Add webhook_subscription_error column to social_accounts
-- Allows distinguishing connected (account exists) vs operational (webhook subscribed).
-- Non-breaking: nullable column, no RLS changes needed (table already covered).

ALTER TABLE social_accounts
  ADD COLUMN "webhook_subscription_error" TEXT;
