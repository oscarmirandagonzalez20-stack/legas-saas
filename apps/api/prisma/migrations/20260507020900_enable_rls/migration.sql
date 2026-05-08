-- Row-Level Security — Sprint 1
-- Depends on: 20260507020800_add_tenant_id_to_messages
--
-- Pattern for every tenant-owned table:
--   1. ENABLE ROW LEVEL SECURITY  — activates RLS
--   2. FORCE ROW LEVEL SECURITY   — applies even to the table owner (prevents accidental bypass)
--   3. PERMISSIVE policy (default) — a row is visible when it satisfies this policy.
--      NOTE: RESTRICTIVE-only policies require at least one PERMISSIVE policy to also pass.
--            Using only RESTRICTIVE without any PERMISSIVE results in 0 rows for every query.
--            The isolation guarantee comes from the USING clause: tenant_id = current_tenant_id().
--            When current_tenant_id() returns NULL (no context), NULL = UUID is always FALSE → 0 rows.
--   4. USING + WITH CHECK — USING filters SELECT/UPDATE/DELETE; WITH CHECK validates INSERT/UPDATE values

-- Helper: reads tenant UUID from transaction-scoped session variable; returns NULL if not set.
-- NULL comparisons are always FALSE → 0 rows returned instead of an error when context is missing.
-- VOLATILE: prevents the planner from constant-folding the result at plan time.
-- A STABLE function is evaluated once during planning (before SET LOCAL runs in the same transaction),
-- which causes the policy filter to collapse to `false` for all rows via One-Time Filter optimization.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
  LANGUAGE sql VOLATILE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- ── memberships ───────────────────────────────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── social_accounts ───────────────────────────────────────────────────────────
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON social_accounts
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── posts ─────────────────────────────────────────────────────────────────────
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON posts
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── comments ──────────────────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comments
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── leads ─────────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── conversations ─────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── messages ──────────────────────────────────────────────────────────────────
-- tenant_id added by 20260507020800; direct comparison (no subquery), same O(1) cost as other tables.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── templates ─────────────────────────────────────────────────────────────────
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON templates
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── automation_rules ──────────────────────────────────────────────────────────
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON automation_rules
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── consents ──────────────────────────────────────────────────────────────────
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON consents
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Append-only: SELECT and INSERT have explicit policies; UPDATE/DELETE have none → default DENY.
-- INSERT allows NULL tenant_id for system-level events (no tenant context on background jobs).
-- SELECT shows only the current tenant's logs; NULL-tenant system rows are hidden from all tenants.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON audit_logs FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_insert ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() OR tenant_id IS NULL);

-- ── ai_calls ──────────────────────────────────────────────────────────────────
-- NULL tenant_id = system-level call (not visible to any tenant via SELECT).
-- INSERT allows NULL so background classification jobs can record calls without tenant context.
ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_calls
  USING  (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id() OR tenant_id IS NULL);

-- ── inbound_events ────────────────────────────────────────────────────────────
-- Global deduplication table; no tenant_id column; RLS not applicable.
