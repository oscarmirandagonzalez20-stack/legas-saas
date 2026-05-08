-- Inicialización de extensiones de Postgres para legal_saas_dev
-- Este archivo se ejecuta automáticamente la primera vez que el contenedor arranca.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Crear rol "bypass_rls" para jobs de mantenimiento que necesiten saltarse RLS.
-- Su uso debe estar explícitamente auditado en código.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bypass_rls') THEN
    CREATE ROLE bypass_rls;
    GRANT ALL PRIVILEGES ON DATABASE legal_saas_dev TO bypass_rls;
  END IF;
END
$$;
