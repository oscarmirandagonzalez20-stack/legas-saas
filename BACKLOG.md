# BACKLOG.md — Issues iniciales (primeros 14 días)

> Cada issue está pensada para ser **autosuficiente, verificable y con criterios de aceptación claros**.
> Convención de etiquetas:
> - `area:` web | api | ai | infra | docs
> - `type:` feat | chore | fix | docs | test
> - `priority:` p0 (bloqueante) | p1 (alta) | p2 (normal)
> - `agent:` cualquiera de 1, 2, 3 (asignación a agente paralelo)
>
> El orden de las issues respeta dependencias. No saltar.

---

## EPIC 1 — Bootstrap del repositorio (Días 1–2)

### Issue #1 — chore(infra): scaffold del monorepo
**Labels:** `area:infra`, `type:chore`, `priority:p0`, `agent:1`

**Descripción:**
Crear la estructura de monorepo: `apps/{web,api,ai}`, `packages/{shared-types,meta-sdk,ui,eslint-config,tsconfig-config}`, `infra/`, `docs/`. Inicializar Turborepo + pnpm workspaces.

**Tareas:**
- [ ] `pnpm init` en raíz, agregar `package.json` provisto.
- [ ] Crear `pnpm-workspace.yaml` y `turbo.json`.
- [ ] Crear `.gitignore`.
- [ ] Configurar Husky + lint-staged.
- [ ] `pnpm install` corre sin errores.

**Criterios de aceptación:**
- `pnpm install` exitoso.
- `git status` muestra todos los archivos esperados.
- `turbo run build` no falla (aunque no haga nada).

---

### Issue #2 — chore(infra): packages/tsconfig-config y packages/eslint-config
**Labels:** `area:infra`, `type:chore`, `priority:p0`, `agent:1`

**Descripción:**
Crear configuraciones compartidas de TypeScript y ESLint que usarán todas las apps.

**Tareas:**
- [ ] `packages/tsconfig-config/` con `base.json`, `nextjs.json`, `nestjs.json`.
- [ ] `packages/eslint-config/` con configs para Next y Nest.
- [ ] Cada `apps/*` extiende su config correspondiente.

**Criterios de aceptación:**
- `pnpm typecheck` corre en todos los paquetes.
- `pnpm lint` corre y solo reporta warnings esperados.

---

### Issue #3 — chore(infra): docker-compose dev (Postgres+Redis)
**Labels:** `area:infra`, `type:chore`, `priority:p0`, `agent:1`

**Descripción:**
Docker compose con `pgvector/pgvector:pg16` y `redis:7-alpine`. Healthchecks. Adminer y Redis Commander como utilidades.

**Tareas:**
- [ ] Archivo `infra/docker/docker-compose.dev.yml`.
- [ ] Script de init SQL para extensiones (`pgcrypto`, `vector`, `pg_trgm`, `uuid-ossp`).
- [ ] Comando `pnpm db:up` y `pnpm db:down` en root `package.json`.

**Criterios de aceptación:**
- `pnpm db:up` levanta servicios sin errores.
- `psql` desde dentro del contenedor confirma extensiones instaladas.
- Adminer accesible en http://localhost:8080.

---

## EPIC 2 — Apps base (Días 2–3)

### Issue #4 — feat(api): NestJS con Fastify, módulo health
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Inicializar NestJS sobre Fastify. Endpoint `GET /health` que valida conexión a Postgres y Redis.

**Tareas:**
- [ ] `nest new apps/api`.
- [ ] Cambiar Express → Fastify.
- [ ] `HealthModule` con `GET /health` que devuelve `{ status, db: "ok"|"error", redis: "ok"|"error" }`.
- [ ] Helmet, CORS configurado para `WEB_URL`.
- [ ] Logger estructurado (Pino).
- [ ] Test e2e del endpoint.

**Criterios de aceptación:**
- `pnpm dev:api` levanta en puerto 4000.
- `curl http://localhost:4000/health` devuelve 200 con DB y Redis OK.

---

### Issue #5 — feat(api): integración Prisma + schema inicial
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Aplicar el `schema.prisma` provisto. Generar cliente. Configurar `PrismaService` global con `setTenantContext()`.

**Tareas:**
- [ ] Copiar `schema.prisma` provisto a `apps/api/prisma/`.
- [ ] Primera migración con nombre `init`.
- [ ] `PrismaService` extendiendo `PrismaClient` con método `setTenantContext(tenantId)` que ejecuta `SET LOCAL app.current_tenant_id`.
- [ ] Conectar a `apps/api/src/main.ts`.
- [ ] Test que valida que `setTenantContext` aplica correctamente.

**Criterios de aceptación:**
- Migración aplicada sin errores.
- `pnpm db:studio` abre Prisma Studio con todas las tablas.
- Test pasa.

---

### Issue #6 — feat(api): migración manual de RLS
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Crear migración manual que activa RLS en todas las tablas con `tenant_id`.

**Tareas:**
- [ ] `pnpm db:migrate:create --name enable_rls`.
- [ ] Reemplazar SQL generado con `manual_rls_setup.sql` provisto.
- [ ] Aplicar migración.
- [ ] Test multi-tenant: crear 2 tenants, escribir dato en uno, validar que con `setTenantContext(otroTenant)` no se ve.

**Criterios de aceptación:**
- `\dp tabla` en psql muestra políticas activas.
- Test multi-tenant pasa.

---

### Issue #7 — feat(web): Next.js con Tailwind y shadcn/ui
**Labels:** `area:web`, `type:feat`, `priority:p0`, `agent:3`

**Descripción:**
Bootstrap de Next.js 15 con App Router, TS estricto, Tailwind 4, shadcn/ui inicializado.

**Tareas:**
- [ ] `create-next-app` con flags correctos.
- [ ] `shadcn@latest init` con estilo "New York" y color "Neutral".
- [ ] Layout base con `Inter` font.
- [ ] Página `/` con un Hero placeholder y un botón shadcn que navega a `/sign-in`.

**Criterios de aceptación:**
- `pnpm dev:web` levanta en puerto 3000.
- Tipografía y estilos cargan correctamente.
- `pnpm build:web` exitoso.

---

### Issue #8 — feat(ai): FastAPI con endpoint /health y stub /classify
**Labels:** `area:ai`, `type:feat`, `priority:p0`, `agent:3`

**Descripción:**
FastAPI mínimo con `GET /health` y `POST /classify` (stub que devuelve respuesta hardcoded por ahora).

**Tareas:**
- [ ] `apps/ai/app/main.py` con FastAPI app.
- [ ] Router `/health` que devuelve `{"status": "ok"}`.
- [ ] Router `/classify` que recibe `{"comment": "..."}` y devuelve placeholder.
- [ ] Pydantic schemas para input/output.
- [ ] Dockerfile para futuro deploy.
- [ ] `uvicorn` reload activo.

**Criterios de aceptación:**
- `pnpm dev:ai` o `cd apps/ai && uv run uvicorn app.main:app --reload --port 8000` levanta.
- `curl http://localhost:8000/health` y `curl -X POST http://localhost:8000/classify -d '{"comment":"hola"}'` funcionan.

---

## EPIC 3 — Auth y Tenants (Días 4–5)

### Issue #9 — feat(web): integración Clerk + sign-in/up
**Labels:** `area:web`, `type:feat`, `priority:p0`, `agent:1`

**Descripción:**
Integrar Clerk con organizations habilitadas (multi-tenant nativo).

**Tareas:**
- [ ] Instalar `@clerk/nextjs`.
- [ ] Middleware Clerk en `middleware.ts`.
- [ ] Páginas `/sign-in` y `/sign-up`.
- [ ] Layout protegido `(app)` que requiere auth.
- [ ] `ClerkProvider` con tema oscuro/claro.
- [ ] Activar Organizations en el dashboard de Clerk.

**Criterios de aceptación:**
- Flujo completo: signup → crear organización → entrar a `/dashboard`.

---

### Issue #10 — feat(api): tenants module + sync con Clerk webhooks
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Cuando se crea una Organization en Clerk, se crea un Tenant en nuestra DB. Idem con users via membership.

**Tareas:**
- [ ] Endpoint `POST /webhooks/clerk` con verificación de firma (svix).
- [ ] Manejar eventos: `organization.created`, `organization.updated`, `organization.deleted`, `user.created`, `organizationMembership.created/deleted`.
- [ ] Persistir en tablas `tenants`, `users`, `memberships`.
- [ ] Tests de cada caso.

**Criterios de aceptación:**
- Crear org en Clerk → registro en `tenants`.
- Invitar usuario → registro en `users` y `memberships`.

---

### Issue #11 — feat(api): TenantContext middleware
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Cada request autenticado extrae el `tenant_id` del JWT de Clerk (`org_id` claim) y lo pone en el contexto de Prisma para esa transacción.

**Tareas:**
- [ ] Guard de Nest `ClerkAuthGuard` que valida el JWT.
- [ ] Interceptor `TenantContextInterceptor` que llama `prisma.setTenantContext(orgId)`.
- [ ] Decorador `@CurrentTenant()` para inyectar el tenantId.
- [ ] Tests de cada componente.

**Criterios de aceptación:**
- Endpoint protegido devuelve 401 sin token, 200 con token válido.
- Test multi-tenant: un usuario de tenant A no puede leer datos de tenant B.

---

## EPIC 4 — Meta OAuth y Webhooks (Días 6–10)

### Issue #12 — feat(api): cifrado AES-256-GCM helper
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:1`

**Descripción:**
Helper `EncryptionService` para cifrar/descifrar tokens con AES-256-GCM.

**Tareas:**
- [ ] `apps/api/src/common/encryption/encryption.service.ts`.
- [ ] Métodos: `encrypt(plaintext): string` (formato `iv:tag:ciphertext` en base64), `decrypt(payload): string`.
- [ ] Lee `ENCRYPTION_KEY` de env (32 bytes base64).
- [ ] Tests: round-trip, falla con clave incorrecta, falla con tag manipulado.

**Criterios de aceptación:**
- Round-trip funciona.
- Tampering del ciphertext lanza error.

---

### Issue #13 — feat(api): packages/meta-sdk inicial
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Crear `packages/meta-sdk` con cliente HTTP tipado para Graph API.

**Tareas:**
- [ ] `MetaGraphClient` con métodos: `getMe`, `getPages`, `getInstagramAccounts`, `subscribeWebhook`, `sendPrivateReply`.
- [ ] Manejo de errores tipados: `MetaApiError` con `code`, `subcode`, `errorUserMessage`.
- [ ] Parser de header `X-Business-Use-Case-Usage`.
- [ ] Retry con backoff exponencial para errores 5xx y rate limit.
- [ ] Tests con mocks de fetch.

**Criterios de aceptación:**
- Tests verdes.
- Tipos exportados desde el package consumibles desde `apps/api`.

---

### Issue #14 — feat(api): OAuth flow Facebook Login
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Implementar OAuth flow completo para conectar Facebook + Instagram.

**Tareas:**
- [ ] Endpoint `GET /meta/oauth/start` que devuelve URL de autorización con scopes correctos.
- [ ] Endpoint `GET /meta/oauth/callback` que intercambia code → short token → long token → page tokens.
- [ ] Persistir en `social_accounts` con tokens cifrados.
- [ ] Suscribir webhooks de la página seleccionada.
- [ ] State parameter para CSRF protection.
- [ ] Audit log al conectar/desconectar.

**Criterios de aceptación:**
- Flow completo desde dashboard funciona end-to-end con cuenta tester.
- Tokens persistidos cifrados.
- Webhook subscription confirmado en API de Meta.

---

### Issue #15 — feat(api): webhook handler /webhooks/meta
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:1`

**Descripción:**
Endpoint que recibe eventos de Meta. Verificación HMAC. Idempotencia. Encolar a BullMQ.

**Tareas:**
- [ ] `GET /webhooks/meta` para challenge (verify token).
- [ ] `POST /webhooks/meta` con verificación `X-Hub-Signature-256`.
- [ ] Body raw para verificación HMAC (config Fastify).
- [ ] Idempotencia: `SETNX inbound:event:{id}` con TTL 24h en Redis.
- [ ] Persistir en `inbound_events`.
- [ ] Encolar job `process-meta-event` en BullMQ.
- [ ] Responder 200 en < 200ms.
- [ ] Tests: firma válida, firma inválida → 403, idempotencia.

**Criterios de aceptación:**
- Tests verdes.
- Test de carga: 100 eventos en paralelo, todos procesados, ninguno duplicado.

---

### Issue #16 — feat(api): worker process-meta-event
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Worker BullMQ que toma eventos de Meta y los disecciona: comentarios → tabla `comments`.

**Tareas:**
- [ ] Procesador de jobs `process-meta-event`.
- [ ] Detectar tipo de evento (comment, message, status).
- [ ] Para comentarios: persistir en `comments` con `intent_score=null` (clasificación viene después).
- [ ] Encolar job `classify-intent` para cada nuevo comentario.
- [ ] Tests con payloads reales de Meta (fixtures).

**Criterios de aceptación:**
- Webhook de comentario llega → registro en `comments` → job de clasificación encolado.

---

## EPIC 5 — IA y Auto-reply (Días 11–14)

### Issue #17 — feat(ai): clasificador de intención v1
**Labels:** `area:ai`, `type:feat`, `priority:p0`, `agent:3`

**Descripción:**
Implementar `POST /classify` real con prompt provisto en `ARQUITECTURA_COMPLETA.md` Sección 8.3.

**Tareas:**
- [ ] Llamar Claude Haiku con el prompt.
- [ ] Validar response JSON con Pydantic.
- [ ] Reintentar si JSON inválido (max 2).
- [ ] Loggear cada llamada con input length, output, latencia.
- [ ] Endpoint `POST /classify` recibe `{comment, tenant_id (opcional)}`.
- [ ] Tests con 20 comentarios reales del despacho ancla.

**Criterios de aceptación:**
- Accuracy >= 80% en `area` sobre golden set de 20 comentarios.
- Latencia p50 < 800ms.

---

### Issue #18 — feat(api): worker classify-intent
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:2`

**Descripción:**
Worker que toma un comentario y llama al servicio AI para clasificarlo.

**Tareas:**
- [ ] Procesador `classify-intent`.
- [ ] HTTP call a `${AI_SERVICE_URL}/classify`.
- [ ] Persistir resultado en `comments.intent_score`, `intent_area`, etc.
- [ ] Si `intent_score >= 0.7`, encolar `send-private-reply`.
- [ ] Persistir en `ai_calls` para auditoría.
- [ ] Tests.

**Criterios de aceptación:**
- E2E: comentario llega → en < 30s tiene clasificación en DB.

---

### Issue #19 — feat(api): worker send-private-reply
**Labels:** `area:api`, `type:feat`, `priority:p0`, `agent:1`

**Descripción:**
Worker que envía el DM al autor del comentario via Private Reply.

**Tareas:**
- [ ] Procesador `send-private-reply`.
- [ ] Cargar plantilla del tenant según área detectada (o plantilla default).
- [ ] Sustituir variables (`{{nombre}}`, etc.).
- [ ] Llamar `metaSdk.sendPrivateReply(commentId, body, pageToken)`.
- [ ] Manejo específico de errores 190 (refresh token), 230 (skip), 551 (lead lost), 10903 (rate limit → reencolar con delay).
- [ ] Persistir en `messages` y crear `lead` + `conversation`.
- [ ] Audit log.
- [ ] Tests.

**Criterios de aceptación:**
- Comentar en post de prueba → 60s después llega DM real.

---

### Issue #20 — feat(web): vista mínima de Inbox
**Labels:** `area:web`, `type:feat`, `priority:p1`, `agent:3`

**Descripción:**
Lista de comentarios procesados con su clasificación y estado de respuesta.

**Tareas:**
- [ ] Página `/inbox`.
- [ ] Server component que lista `comments` del tenant actual paginados.
- [ ] Columnas: autor, comentario, área, score, replied?, fecha.
- [ ] Filtros: área, replied/no-replied.
- [ ] Sin acciones todavía (solo lectura). Acciones vienen en Sprint 4.

**Criterios de aceptación:**
- Página renderiza con datos reales.
- Aislamiento multi-tenant verificado.

---

## RESUMEN DE EJECUCIÓN

| Día | Issues | Validación clave |
|---|---|---|
| 1 | #1, #2, #3 | `pnpm install` + `pnpm db:up` |
| 2 | #4, #5, #6 | `/health` 200 + RLS test pasa |
| 3 | #7, #8 | Web y AI levantan |
| 4 | #9 | Sign-up + crear org |
| 5 | #10, #11 | Tenant sync + multi-tenant guard |
| 6 | #12, #13 | Cifrado + meta-sdk con tests |
| 7 | #14 | OAuth conectado end-to-end |
| 8 | #15 | Webhook recibe y deduplica |
| 9 | #16 | Comentarios persisten |
| 10 | (buffer / fixes) | — |
| 11 | #17 | AI clasifica con accuracy ≥80% |
| 12 | #18 | E2E hasta clasificación |
| 13 | #19 | **DEMO: comentario → DM real** |
| 14 | #20 | Inbox visible |
