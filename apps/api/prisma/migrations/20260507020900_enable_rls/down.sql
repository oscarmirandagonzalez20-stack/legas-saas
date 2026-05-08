-- Rollback: 20260507020900_enable_rls
-- Must run BEFORE rolling back 20260507020800 (messages still needs tenant_id for these DROP POLICYs to parse)

ALTER TABLE ai_calls        DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls        NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON ai_calls;

ALTER TABLE audit_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_select ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_insert ON audit_logs;

ALTER TABLE consents        DISABLE ROW LEVEL SECURITY;
ALTER TABLE consents        NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON consents;

ALTER TABLE automation_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON automation_rules;

ALTER TABLE templates       DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates       NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON templates;

ALTER TABLE messages        DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages        NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON messages;

ALTER TABLE conversations   DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON conversations;

ALTER TABLE leads           DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads           NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON leads;

ALTER TABLE comments        DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments        NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON comments;

ALTER TABLE posts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts            NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON posts;

ALTER TABLE social_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON social_accounts;

ALTER TABLE memberships     DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships     NO FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation        ON memberships;

DROP FUNCTION IF EXISTS current_tenant_id();
