#!/usr/bin/env bash
# CI guard: fail if any table has tenant_id but RLS is not enabled.
# Usage: DATABASE_URL=postgresql://... ./prisma/scripts/validate-rls.sh

set -euo pipefail

MISSING=$(psql "$DATABASE_URL" --no-psqlrc -t -A -c "
  SELECT t.tablename
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = t.tablename
        AND c.column_name  = 'tenant_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_class  cls
      JOIN   pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE  ns.nspname     = 'public'
        AND  cls.relname    = t.tablename
        AND  cls.relrowsecurity = true
    );
")

if [ -n "$MISSING" ]; then
  echo "FAIL: tables with tenant_id but RLS not enabled:"
  echo "$MISSING"
  exit 1
fi

echo "OK: all tenant-scoped tables have RLS enabled."
