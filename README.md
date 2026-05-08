# Legal SaaS

> Plataforma SaaS multi-tenant de captación automatizada de leads para despachos jurídicos premium en Facebook e Instagram.

**Estado:** Sprint 0 — bootstrap.
**Documentación principal:** ver `ARQUITECTURA_COMPLETA.md` y `CLAUDE.md`.

---

## Quickstart (desarrollo local)

```bash
# 1. Requisitos previos
#    - Node ≥ 20.11
#    - pnpm ≥ 9
#    - Docker Desktop (o Docker Engine + Compose plugin)
#    - Git

# 2. Clonar e instalar
git clone <repo-url>
cd legal-saas
pnpm install

# 3. Variables de entorno
cp .env.example .env
# Editar .env: como mínimo generar ENCRYPTION_KEY y META_VERIFY_TOKEN.
# Otras claves se pueden dejar vacías y agregar conforme avance el sprint.

# 4. Levantar Postgres + Redis
pnpm db:up

# 5. Migraciones
pnpm db:migrate

# 6. Levantar dev (web + api + ai en paralelo)
pnpm dev
```

URLs de desarrollo:
- Web (Next.js): http://localhost:3000
- API (NestJS): http://localhost:4000
- AI (FastAPI): http://localhost:8000
- Adminer (DB GUI): http://localhost:8080
- Redis Commander: http://localhost:8081

---

## Documentación

- `CLAUDE.md` — contrato del proyecto para Claude Code (lectura obligatoria).
- `AGENTS.md` — convenciones para agentes (Antigravity, etc.).
- `ARQUITECTURA_COMPLETA.md` — diseño técnico end-to-end.
- `SETUP.md` — guía paso a paso desde cero.
- `BACKLOG.md` — issues iniciales para los primeros 14 días.
- `SECURITY.md` — reglas críticas de seguridad.
- `CHECKLIST.md` — validación de que el setup quedó correcto.
- `WHAT_NOT_TO_BUILD.md` — anti-features (qué evitar a toda costa).
- `docs/adr/` — decisiones de arquitectura.
- `docs/runbooks/` — playbooks de operación.

---

## Estructura

```
apps/
  web/      Next.js 15 dashboard
  api/      NestJS API + workers BullMQ
  ai/       FastAPI Python (clasificación de intención)
packages/
  shared-types/   Zod schemas + TS types
  meta-sdk/       Wrapper tipado de Graph API
  ui/             Componentes shadcn (Fase 2)
  eslint-config/
  tsconfig-config/
infra/
  docker/         docker-compose dev
  terraform/      IaC (Fase 1+)
docs/
.github/workflows/
```

---

## Comandos clave

Ver lista completa en `package.json`. Los más usados:

```bash
pnpm dev                # Todo
pnpm db:migrate         # Aplicar migraciones
pnpm typecheck          # TS strict en todos los paquetes
pnpm test               # Tests
pnpm lint               # ESLint
```

---

## Licencia

Propietario. Todos los derechos reservados.
