# @legal-saas/api

API NestJS sobre Fastify. Webhooks de Meta, CRM, colas BullMQ.

## Estado: scaffolding pendiente (Issue #4)

Sigue `SETUP.md` sección 6 para inicializar:

```bash
cd apps/api
pnpm dlx @nestjs/cli@latest new . --skip-git --package-manager pnpm
# Reemplazar Express por Fastify:
pnpm add @nestjs/platform-fastify fastify
# Prisma + auth + colas:
pnpm add @prisma/client @clerk/backend bullmq ioredis zod
pnpm add -D prisma tsx
```

## Módulos planeados (Fase 1)

- `health/` — `/health` y `/ready` (DB + Redis).
- `tenants/` — CRUD, sync Clerk.
- `auth/` — guard JWT Clerk, middleware `TenantContext` (setea RLS).
- `meta/` — OAuth, webhooks (raw body + HMAC), enqueue a workers.
- `crm/` — leads, conversaciones, mensajes, plantillas.
- `automation/` — reglas, evaluación.
- `audit/` — escritura append-only.
- `workers/` — `process-meta-event`, `classify-intent`, `send-private-reply`, `send-dm`.

## Convenciones

- `tenantId` siempre setea `current_tenant_id` antes de cualquier query (ver ADR 0002).
- Webhooks: contestar 200 en <200ms, todo trabajo en cola.
- Errores Meta: helper `metaErrorHandler.ts` mapea 190/200/230/551/10903.
- Logs estructurados (pino) con `redactSecrets`.
