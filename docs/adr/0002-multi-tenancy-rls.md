# ADR 0002 — Multi-tenancy con shared DB + Row-Level Security

- **Estado:** Aceptado
- **Fecha:** 2026-05-06

## Contexto

El SaaS sirve a múltiples despachos (tenants). Cada despacho ve sólo sus leads, conversaciones, plantillas y configuraciones. Una fuga de datos entre tenants es un evento de tipo "fin del producto" — más aún tratándose de información legal sensible.

## Decisión

**Modelo:** Shared database, shared schema, con `tenantId` en toda tabla de negocio + **Row-Level Security (RLS)** de PostgreSQL como red de seguridad.

**Implementación:**
1. Toda tabla excepto `tenants` y `users` (perfil global) tiene columna `tenant_id UUID NOT NULL`.
2. Migración manual habilita `ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` en cada tabla.
3. Función `current_tenant_id()` lee `current_setting('app.current_tenant_id')`.
4. Política `tenant_isolation_*` filtra `USING (tenant_id = current_tenant_id())`.
5. Middleware NestJS ejecuta `SET LOCAL app.current_tenant_id = $1` por request, derivado del JWT de Clerk + tabla `memberships`.
6. **Defensa en profundidad:** además del RLS, los repositorios filtran explícitamente por `tenantId` en cada query Prisma.
7. Tests E2E de aislamiento: dos tenants, peticiones cruzadas devuelven 404.

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| DB por tenant | Operativamente costoso; difícil de migrar; sobrematado para Fase 1. |
| Schema por tenant | Migraciones se vuelven N×; complica conexiones y pooling. |
| Solo filtro en aplicación | Un bug = fuga total. Inaceptable para datos legales. |

## Consecuencias

**Positivas:**
- Una sola DB para operar y respaldar.
- RLS es a prueba de bugs en código aplicación (siempre que el `SET` esté correcto).
- Migraciones únicas.

**Negativas / a vigilar:**
- Toda conexión debe setear `current_tenant_id` o las queries fallan/no devuelven nada — tests obligatorios.
- Workers (BullMQ) deben recuperar el `tenantId` del job y aplicarlo antes de cada query.
- Backups y exports requieren cuidado para no mezclar tenants.
- Cuando un tenant Enterprise pida datos aislados, puede convivir con esquema híbrido o DB dedicada en el futuro.

## Referencias

- https://www.postgresql.org/docs/16/ddl-rowsecurity.html
- `apps/api/prisma/migrations/manual_rls_setup.sql`
