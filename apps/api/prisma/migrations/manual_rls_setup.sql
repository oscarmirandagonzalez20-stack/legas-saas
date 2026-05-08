-- Migración manual: activar Row-Level Security en tablas multi-tenant.
-- Esta migración se aplica DESPUÉS de la migración inicial de Prisma.
-- Crear con: pnpm db:migrate:create --name enable_rls
-- Y reemplazar el contenido del .sql generado con este archivo.

-- Función helper para obtener el tenant actual de la sesión.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- Aplicar RLS a cada tabla con tenant_id.
-- Patrón repetido: ENABLE RLS + policy de aislamiento.

-- tenants: cada usuario solo ve los tenants en los que tiene membership (gestionado a nivel app).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- social_accounts
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_social_accounts ON social_accounts
  USING (tenant_id = current_tenant_id());

-- posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_posts ON posts
  USING (tenant_id = current_tenant_id());

-- comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_comments ON comments
  USING (tenant_id = current_tenant_id());

-- leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_leads ON leads
  USING (tenant_id = current_tenant_id());

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_conversations ON conversations
  USING (tenant_id = current_tenant_id());

-- messages: heredan tenant via conversation
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_messages ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = current_tenant_id()
    )
  );

-- templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_templates ON templates
  USING (tenant_id = current_tenant_id());

-- automation_rules
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_automation_rules ON automation_rules
  USING (tenant_id = current_tenant_id());

-- consents
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_consents ON consents
  USING (tenant_id = current_tenant_id());

-- audit_logs: política especial. Lecturas restringidas al tenant; inserts permitidos
-- siempre (los crea el sistema), pero con tenant_id explícito.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_logs_select ON audit_logs FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ai_calls
ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_calls ON ai_calls
  USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

-- inbound_events: globales, sin tenant_id (deduplicación de webhook). RLS no aplica.

-- IMPORTANTE: bypass para el rol "bypass_rls" usado por jobs de mantenimiento.
-- Los jobs deben hacer: SET LOCAL ROLE bypass_rls; -- y registrar en audit_logs.
ALTER TABLE social_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;
ALTER TABLE comments FORCE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;
