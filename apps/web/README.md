# @legal-saas/web

Frontend Next.js 15 (App Router) del SaaS legal. Dashboard del despacho.

## Estado: scaffolding pendiente (Issue #7)

Sigue `SETUP.md` sección 6 para inicializar:

```bash
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
pnpm dlx shadcn@latest init
pnpm add @clerk/nextjs
```

## Vistas planeadas (Fase 1)

- `/` — Landing pública.
- `/sign-in`, `/sign-up` — Clerk.
- `/onboarding` — primer login: nombre del despacho, conexión Meta.
- `/inbox` — feed de comentarios + DMs por canal.
- `/leads` — kanban (NEW → CLIENT).
- `/templates` — biblioteca de plantillas con disclaimer.
- `/settings` — usuarios, integraciones, billing.

## Notas

- Estilos: Tailwind + shadcn/ui (componentes copiados, no librería externa).
- Auth: Clerk con MFA forzado a roles `OWNER` y `LAWYER`.
- API: llamadas a `apps/api` vía fetch + JWT de Clerk.
