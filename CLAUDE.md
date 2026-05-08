# CLAUDE.md — Instrucciones para Claude Code

> **Si estás leyendo esto como Claude Code, este es tu contrato con el proyecto.**
> Lee este archivo antes de cada sesión de trabajo. Está optimizado para ser breve, accionable y prevenir errores costosos.

---

## 1. Contexto del proyecto

**Nombre:** Legal SaaS (working title)
**Qué es:** Plataforma SaaS multi-tenant que automatiza la captación de leads para despachos jurídicos premium en Facebook e Instagram. Detecta comentarios con intención de contratar servicios legales, clasifica el área (familiar, fiscal, mercantil, penal…), envía un DM privado vía la Private Replies API de Meta, y registra al lead en un CRM interno con seguimiento automatizado.

**Cliente ancla / piloto:** Despacho del Abog. Óscar Miranda (México).
**Mercado:** México inicialmente, expansión LATAM.
**Idioma del producto:** Español MX (los textos de UI deben usar terminología mexicana, no neutral).

**Lectura obligatoria antes de cualquier feature:** `docs/architecture.md` (si no existe aún, está en el documento `ARQUITECTURA_COMPLETA.md` del paquete inicial).

---

## 2. Stack autorizado (no introducir alternativas sin ADR previo)

| Capa | Tecnología | Versión |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm ≥ 9, turbo ≥ 2 |
| Frontend | Next.js (App Router) + TypeScript estricto | Next 15.x, TS 5.x |
| UI | TailwindCSS + shadcn/ui (Radix) | Tailwind 4.x |
| Estado cliente | TanStack Query v5 + Zustand | — |
| Forms | react-hook-form + zod | — |
| Charts | Recharts o Tremor | — |
| Backend API | NestJS sobre Fastify (no Express) + TypeScript | Nest 10.x |
| ORM | Prisma | 5.x |
| DB | PostgreSQL + extensión pgvector | Postgres 16 |
| Cache/Queue | Redis + BullMQ | Redis 7 |
| AI service | FastAPI + Python | Python 3.12 |
| LLM provider primario | Anthropic Claude (Sonnet para razonamiento, Haiku para clasificación) | API actual |
| Auth | Clerk (multi-tenant orgs) | última estable |
| Pagos | Stripe (primario) + MercadoPago (secundario) | última estable |
| Observability | Sentry + Axiom (o Better Stack) + PostHog | — |
| Hosting MVP | Vercel (web) + Railway/Render (api+ai) | — |

**Reglas:**
- No introducir Express, MongoDB, Mongoose, GraphQL, tRPC, Drizzle, Supabase Auth, NextAuth, Mongoose, Sequelize, Redux, Jotai, Recoil ni Material UI sin un ADR aprobado en `docs/adr/`.
- No introducir un framework CSS adicional. Tailwind + shadcn/ui es suficiente.
- No introducir un segundo idioma de backend. Node es para API; Python es solo para `apps/ai`.

---

## 3. Estructura del repositorio

```
legal-saas/
├── apps/
│   ├── web/      → Next.js 15 dashboard (Vercel)
│   ├── api/      → NestJS API + workers BullMQ (Railway)
│   └── ai/       → FastAPI Python para clasificación/embeddings (Railway)
├── packages/
│   ├── shared-types/   → Zod schemas + TS types compartidos
│   ├── meta-sdk/       → Wrapper tipado de Graph API
│   ├── ui/             → componentes shadcn compartidos (Fase 2)
│   ├── eslint-config/
│   └── tsconfig-config/
├── infra/
│   ├── docker/         → docker-compose para dev local
│   └── terraform/      → IaC (Fase 1+, no tocar antes)
├── docs/
│   ├── adr/            → Architecture Decision Records
│   ├── runbooks/       → On-call playbooks
│   └── compliance/
└── .github/workflows/
```

**Reglas estructurales:**
- Cualquier código compartido entre `apps/web` y `apps/api` vive en `packages/shared-types/`. Nada de imports cross-app directos.
- Tipos generados por Prisma viven en `apps/api/`. Si `apps/web` necesita esos tipos, se exportan via `packages/shared-types`.
- La carpeta `infra/terraform/` no se toca durante el MVP. Está reservada para Fase 1.

---

## 4. Comandos del proyecto

```bash
# Desarrollo
pnpm dev                    # Levanta web + api + ai en paralelo (Turbo)
pnpm dev:web                # Solo Next.js
pnpm dev:api                # Solo NestJS
pnpm dev:ai                 # Solo FastAPI

# Base de datos
pnpm db:up                  # Levanta Postgres+Redis con docker-compose
pnpm db:down                # Apaga contenedores
pnpm db:migrate             # Aplica migraciones Prisma
pnpm db:migrate:create      # Crea nueva migración
pnpm db:studio              # Abre Prisma Studio
pnpm db:seed                # Seed de datos demo
pnpm db:reset               # ¡PELIGRO! Drop + recreate. Solo dev.

# Calidad
pnpm typecheck              # tsc --noEmit en todos los paquetes
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint --fix
pnpm format                 # Prettier --write
pnpm test                   # Tests unitarios
pnpm test:e2e               # Playwright (cuando exista)

# Build
pnpm build                  # Build de todo
pnpm build:web              # Solo web
```

**Antes de cualquier commit, Claude Code debe correr:**
```bash
pnpm typecheck && pnpm lint && pnpm test
```
Si falla, no commitear. Arreglar primero.

---

## 5. Convenciones de código (sin excepciones)

### TypeScript
- `strict: true` en todos los `tsconfig.json`. No relajar.
- **Prohibido `any`**. Usar `unknown` y validar con zod. Si crees que necesitas `any`, hay un bug arquitectónico.
- **Prohibido `as` casting** salvo después de `zod.parse()` o sobre primitivos seguros. Nada de `as Foo`.
- Funciones que crucen el límite del proceso (HTTP, DB, queue) **deben** validar input/output con zod.
- Manejo de errores: `Result<T, E>` o excepciones tipadas (`MetaApiError`, `IntentClassificationError`). Nada de `throw "string"`.

### Naming
- DB: `snake_case` para tablas y columnas. Prisma mapea a `camelCase` en TS via `@map`.
- Endpoints REST: `kebab-case` plural (`/social-accounts`, `/leads`).
- Variables y funciones TS: `camelCase`. Tipos y clases: `PascalCase`. Constantes: `SCREAMING_SNAKE_CASE`.
- Archivos React: `kebab-case.tsx` (no PascalCase).
- Archivos Nest: `*.controller.ts`, `*.service.ts`, `*.module.ts`.

### Tests
- Tests al lado del archivo: `foo.ts` + `foo.spec.ts`.
- Nest: usar el TestingModule. Mockear repositorios de Prisma con `prisma-mock`.
- Frontend: Vitest + Testing Library. Playwright para e2e.
- Cobertura mínima en módulos de seguridad/auth/webhooks: **90%**. En el resto: 70%.

### Commits
- Formato Conventional Commits: `feat(api): ...`, `fix(web): ...`, `chore(deps): ...`, `docs(adr): ...`.
- Un commit = un cambio lógico. Si dudas, divide.

### Pull Requests
- Plantilla en `.github/PULL_REQUEST_TEMPLATE.md`.
- Cero PRs sin tests para cualquier código en `apps/api/src/modules/{auth,meta,billing}` o cualquier endpoint que escriba a DB.

---

## 6. Reglas multi-tenant (LAS MÁS IMPORTANTES)

**Una sola fuga cross-tenant es un evento de extinción para el SaaS.**

1. **Toda tabla con datos de negocio tiene columna `tenant_id` (uuid, FK a `tenants`)**. No hay excepciones salvo: `tenants`, `users` (los usuarios pueden pertenecer a varios tenants vía `memberships`), y `audit_logs` (que también tiene tenant_id pero permite globales).

2. **Postgres Row-Level Security (RLS) está activado en todas las tablas con `tenant_id`** desde la migración inicial. Las políticas usan `current_setting('app.current_tenant_id')`.

3. **Cada request al API hace `SET LOCAL app.current_tenant_id = '<uuid>'`** dentro de la transacción, **antes** de cualquier query. Esto se hace en un middleware/interceptor de Nest. **Nunca** en lógica de negocio.

4. **Prisma queries nunca filtran por `tenantId` manualmente.** El filtrado viene de RLS. Si una query necesita saltarse RLS (ej. job cross-tenant de mantenimiento), debe usar `prisma.$executeRawUnsafe('SET LOCAL ROLE bypass_rls')` con auditoría obligatoria.

5. **Tests unitarios obligatorios para RLS:** cada feature que toque la DB tiene test que valida que tenant A no puede leer datos de tenant B.

6. **Workers BullMQ heredan tenant_id del job payload**. El primer paso del worker es `setTenantContext(job.data.tenantId)`. Si no hay tenant_id, el job falla con error.

7. **Nunca loguear `tenant_id` junto con datos personales del lead** sin enmascaramiento. Logs structurados usan `tenantId: <uuid>` y `leadId: <uuid>` por separado.

---

## 7. Reglas de seguridad de tokens y secretos

1. **Tokens de Meta (`access_token` de páginas FB e IG) se cifran con AES-256-GCM** antes de persistir en `social_accounts.access_token_encrypted`. La clave maestra vive en KMS (AWS o GCP), nunca en `.env` de producción.

2. **En desarrollo local**, la clave de cifrado vive en `.env` pero `.env` está en `.gitignore`. Solo `.env.example` se commitea.

3. **Logs nunca contienen tokens, ni siquiera truncados.** Si vas a loguear un objeto, usa el helper `redactSecrets(obj)` de `packages/shared-types`.

4. **Verificación HMAC en webhooks de Meta es obligatoria y sin atajos.** Header `X-Hub-Signature-256`. Comparación con `crypto.timingSafeEqual`. Si falla, `403`.

5. **Idempotencia de webhooks:** todo evento se deduplica por `comment_id` o `event_id` con `SETNX` en Redis (TTL 24h). Si ya se procesó, responder `200` y descartar.

6. **Webhook handler debe responder `200` en menos de 200ms.** Todo procesamiento real va a una cola BullMQ. Meta tiene timeout de 5s y reintenta agresivamente — un handler lento causa duplicados y eventual deshabilitación del webhook.

7. **Rate limit de Meta:** parsear header `X-Business-Use-Case-Usage` después de cada llamada. Cuando `call_count > 75`, pausar el worker correspondiente y reencolar con backoff.

8. **Rotación de secretos:** todas las claves (KMS, Anthropic, Stripe, Clerk) tienen fecha de rotación documentada en `docs/runbooks/secret-rotation.md`. Trimestral mínimo.

9. **MFA obligatorio en producción** para cualquier usuario con rol `owner` o `lawyer`. Lo enforce Clerk.

---

## 8. Reglas de IA / LLM (CRÍTICAS por riesgo legal)

1. **El LLM nunca responde en DM directamente al usuario final.** El LLM solo:
   - Clasifica intención y área legal del comentario.
   - Sugiere al abogado humano cuál plantilla usar.
   - Sugiere etiquetas para el lead.

2. **Toda respuesta enviada a un lead viene de una `template` aprobada por el despacho.** Variables de plantilla (`{{nombre}}`, `{{post_url}}`) se sustituyen, pero no se generan oraciones libres.

3. **Disclaimer obligatorio en la primera plantilla:** "Este mensaje es informativo y no constituye asesoría legal." Está hard-coded como mínimo en cualquier plantilla; los despachos pueden ampliarlo pero no quitarlo.

4. **Logs de IA:** cada llamada al LLM se persiste en `ai_calls` (table) con: prompt template version, input length, output, costo estimado, latencia. Para auditoría y para detectar drift de modelo.

5. **Costo:** alerta automática si un tenant rebasa 2x su budget mensual de IA. Pausar clasificación automática hasta intervención humana.

---

## 9. Reglas de Meta Graph API

1. **Todas las llamadas a Graph API pasan por `packages/meta-sdk`**. Nada de `fetch` directo al API. Esto centraliza retry, rate limit, logging y manejo de errores.

2. **Versión del API fijada por config:** `META_GRAPH_VERSION=v21.0`. Para subir versión, ADR + tests de regresión.

3. **`messaging_type: 'RESPONSE'`** en envíos de Private Reply (no `MESSAGE_TAG`, no `UPDATE`). Si se necesita otro, ADR.

4. **Ventana de 7 días** para Private Reply (post-comentario). El `comment_id` se invalida después. Worker debe descartar jobs de DM cuyo `comment_id` tenga > 7 días.

5. **Ventana de 24 horas** para Messenger después del primer DM. Después solo plantillas pre-aprobadas. El sistema marca `conversation.in_24h_window` y bloquea envíos no permitidos.

6. **Errores específicos a manejar individualmente** (lista no exhaustiva): `190` (token expirado → refresh), `200` (permiso faltante → notificar), `230` (fuera de ventana → plantilla autorizada), `551` (usuario bloqueó → marcar lost), `10903` (rate limit → backoff). Nunca un `catch (err)` genérico que oculte el subcode.

7. **App Review:** el modo Development solo permite Tester Users. Producción real requiere App Review aprobado. No prometer features a clientes que dependen de permisos no aprobados aún.

---

## 10. Cosas que NUNCA hacer

- ❌ Loguear access_token, password_hash, ni cuerpo de mensajes con PII sin enmascarar.
- ❌ Hacer queries con Prisma que filtren tenantId manualmente (depender de RLS).
- ❌ Llamar al LLM dentro del thread del webhook (siempre via cola).
- ❌ Responder al webhook de Meta con código distinto a 200, salvo 403 por firma inválida.
- ❌ Construir un visual flow builder tipo ManyChat. No es nuestro diferenciador y consume meses.
- ❌ Construir features para TikTok, YouTube o X antes de Fase 2/3/4.
- ❌ Permitir que el LLM genere texto que se envía directamente al usuario final.
- ❌ Almacenar tokens en texto plano, ni siquiera en dev.
- ❌ Hacer deploy a producción sin pasar `pnpm typecheck && pnpm lint && pnpm test`.
- ❌ Introducir librerías nuevas sin ADR si el problema se resuelve con el stack actual.
- ❌ Hacer commits a `main` directamente. Todo va por PR con CI verde.
- ❌ Borrar audit logs. Son inmutables y append-only.

---

## 11. Cómo agregar una nueva feature (checklist)

Antes de programar:
- [ ] Escribir 3-5 líneas en `docs/adr/NNNN-feature-name.md` describiendo qué y por qué.
- [ ] Identificar a qué módulo Nest pertenece (o crear uno nuevo).
- [ ] Definir Zod schema en `packages/shared-types`.

Durante:
- [ ] Migración Prisma si toca DB. RLS policy en la misma migración.
- [ ] Endpoint con DTO validado.
- [ ] Test unitario y de integración.
- [ ] Test multi-tenant: A no puede leer/modificar datos de B.
- [ ] Si toca tokens/secretos, revisión doble del cifrado.
- [ ] Si toca webhooks, test de idempotencia y firma inválida.

Antes de PR:
- [ ] `pnpm typecheck && pnpm lint && pnpm test` verde.
- [ ] Audit log si la acción es relevante.
- [ ] Documentar en README de la app si cambia comportamiento público.

---

## 12. Cuando dudes

1. Lee `docs/architecture.md`.
2. Si no resuelve, lee el ADR correspondiente.
3. Si no existe ADR, **crea uno antes de programar**. Las decisiones no documentadas son deuda técnica futura.
4. Pregunta al humano antes de hacer un cambio que afecte: schema de DB, modelo de auth, webhooks, cifrado de tokens, integraciones de pago.

---

**Versión:** 1.0
**Última actualización:** Sprint 0
