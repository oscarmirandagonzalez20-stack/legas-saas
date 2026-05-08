# SECURITY.md — Reglas estrictas de seguridad

> Una sola fuga puede acabar con el SaaS. Estas reglas son obligatorias y no negociables.
> Toda violación bloquea el merge a `main`. Si tu PR rompe alguna, devuélvelo a draft.

---

## 1. Tokens y secretos

### 1.1 Almacenamiento de tokens de terceros (Meta, Stripe, etc.)

- ✅ **Cifrar con AES-256-GCM** antes de persistir. Usar `EncryptionService`.
- ✅ Clave maestra en KMS (AWS KMS o GCP Secret Manager) en producción. En dev, en `.env`.
- ✅ Rotación de la clave maestra **mínimo trimestral**. Rotación documentada en `docs/runbooks/key-rotation.md`.
- ❌ **NUNCA** texto plano en DB.
- ❌ **NUNCA** loguear el token, ni siquiera truncado a 5 chars.
- ❌ **NUNCA** retornar el token al cliente (web), ni siquiera "para verificar". Si el frontend necesita saber si está conectado, devolver booleano.

### 1.2 Variables de entorno

- ✅ `.env` está en `.gitignore`. Si commiteas un secret accidentalmente, **rota el secret antes que rebases**.
- ✅ En CI, secrets se inyectan via GitHub Actions Secrets / Vercel/Railway env. Nunca hardcodeados.
- ✅ Cada secret tiene un owner (equipo o persona) responsable de su rotación.
- ❌ No compartir secrets de producción por Slack/email/Discord. Usar 1Password Business o equivalente.

### 1.3 Logs

- ✅ Logger estructurado (Pino, structlog). Cada log es JSON.
- ✅ Antes de loguear cualquier objeto que pueda contener PII o tokens, pasarlo por `redactSecrets()`.
- ✅ Campos a redactar siempre: `access_token`, `refresh_token`, `password`, `Authorization`, `cookie`, `set-cookie`, `email` (parcialmente: `j***@gmail.com`), `whatsapp_phone` (últimos 4 dígitos visibles).
- ❌ No loguear el body completo de webhooks (puede contener PII del lead).

---

## 2. Webhooks

### 2.1 Webhooks entrantes (Meta, Clerk, Stripe)

- ✅ **Verificación de firma OBLIGATORIA** antes de procesar:
  - Meta: HMAC-SHA256 con `X-Hub-Signature-256` header y `META_APP_SECRET`.
  - Clerk: usar `svix` library.
  - Stripe: `stripe.webhooks.constructEvent` con `STRIPE_WEBHOOK_SECRET`.
- ✅ Si la firma falla → responder `403`, **no loguear el body**.
- ✅ Comparar firmas con `crypto.timingSafeEqual` (resistente a timing attacks).
- ✅ Endpoint debe leer el **raw body** (no el parsed JSON). En Fastify configurar:
  ```ts
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)
  ```

### 2.2 Idempotencia

- ✅ Cada evento entrante se deduplica por su ID externo:
  - Meta: `comment_id` o `message_id`.
  - Stripe: `event.id`.
- ✅ Usar `SET key NX EX 86400` en Redis (no `SETEX` solo, no `SET` solo).
- ✅ Si ya procesado, responder 200 y descartar.

### 2.3 Rapidez de respuesta

- ✅ Webhook handler responde en **< 200ms p99**. Todo procesamiento real va a cola.
- ❌ No hacer queries pesadas, no llamar al LLM, no llamar a Graph API dentro del handler.

### 2.4 Webhooks salientes

- (Aplicará cuando ofrezcamos webhooks a despachos en Fase 2.)
- Firmar nuestros webhooks con HMAC-SHA256 + secret por suscripción.
- Reintentar con backoff exponencial: 1m, 5m, 30m, 2h, 8h, 24h.
- Endpoint receptor debe responder 2xx en < 5s.

---

## 3. Multi-tenant

### 3.1 Garantías a nivel DB

- ✅ Toda tabla con datos de negocio tiene columna `tenant_id` y RLS activado.
- ✅ Política RLS estándar: `USING (tenant_id = current_tenant_id())`.
- ✅ `FORCE ROW LEVEL SECURITY` activado (incluso para owners de tabla).
- ✅ Rol `bypass_rls` solo se usa en jobs específicos con audit log obligatorio.

### 3.2 Garantías a nivel aplicación

- ✅ Middleware `TenantContextInterceptor` ejecuta `SET LOCAL app.current_tenant_id` **antes** de cada query.
- ✅ Si el `tenant_id` no se puede resolver del JWT, request falla con 401/403.
- ✅ Workers BullMQ heredan `tenant_id` del job payload. Sin `tenant_id` en payload → job falla.
- ✅ Tests automáticos: cada feature que toca DB tiene un test que valida que tenant A no puede leer/modificar datos de tenant B.

### 3.3 Anti-patterns prohibidos

- ❌ Filtrar por `tenantId` manualmente en el `where` de Prisma. Confiar en RLS.
- ❌ Endpoints públicos que reciben `tenantId` como parámetro de URL/body sin validar contra el JWT.
- ❌ Joins entre tablas de tenants distintos en una sola query.

---

## 4. Auth y autorización

- ✅ Auth gestionada por Clerk (provider de identidad).
- ✅ Cada endpoint protegido tiene un `Guard` que valida JWT.
- ✅ Autorización por rol via `@RequireRole(Role.OWNER)`. Nunca hardcodear lógica de role checks en el cuerpo.
- ✅ MFA obligatorio para roles `OWNER` y `LAWYER` en producción. Configurado en Clerk.
- ✅ Sessions: JWT corto (15 min) + refresh token rotativo, gestionado por Clerk.
- ❌ No emitir tokens propios largos sin justificación documentada.

---

## 5. Validación de input

- ✅ Todo endpoint REST valida su DTO con `zod` o `nestjs-zod`.
- ✅ Todo job BullMQ valida su payload con zod en el primer paso del processor.
- ✅ Toda llamada a un servicio externo (incluido AI) valida la response con zod antes de usarla.
- ❌ No `JSON.parse` sin un schema posterior.
- ❌ No confiar en typings de TypeScript para datos de I/O. TS no existe en runtime.

---

## 6. Datos personales (LFPDPPP / GDPR-style)

### 6.1 Recolección

- ✅ Aviso de privacidad público y enlazado en cada plantilla de DM.
- ✅ Opt-in explícito: el primer DM incluye "Si no deseas recibir más mensajes, responde NO". Si responde NO, marcar `consents.granted = false` y **bloquear** futuros envíos a ese `external_user_id`.
- ✅ Consentimiento se persiste en `consents` con timestamp y evidencia (link al mensaje).

### 6.2 Acceso (derechos ARCO en MX)

- ✅ Endpoint `POST /privacy/arco-request` que recibe: tipo (acceso/rectificación/cancelación/oposición), titular, evidencia.
- ✅ SLA de respuesta: 20 días hábiles.
- ✅ Solicitudes registradas en `audit_logs`.

### 6.3 Eliminación

- ✅ Cuando un titular solicita cancelación, eliminar:
  - `leads`, `conversations`, `messages` (cascade).
  - `comments` con su `external_user_id`.
  - `consents` se conserva como evidencia de que se ejercitó el derecho.
- ✅ Audit log obligatorio del proceso de eliminación.

---

## 7. Audit logs

- ✅ `audit_logs` es **append-only**. No hay endpoint de update/delete.
- ✅ Acciones que se loguean siempre:
  - Login / logout.
  - Conexión / desconexión de cuenta de Meta.
  - Cambio de plantilla (incluye diff antes/después).
  - Envío de DM (incluye `meta_message_id`).
  - Cambio de etapa de lead.
  - Cambio de rol de usuario.
  - Solicitudes ARCO.
  - Uso del rol `bypass_rls`.
- ✅ Logs antiguos se exportan a S3 con Object Lock (WORM) trimestralmente.
- ❌ Borrar logs es ilegal en muchos casos. No se hace.

---

## 8. Comunicación con servicios externos

- ✅ Toda llamada saliente:
  - Tiene timeout configurado (default 10s).
  - Tiene retry con backoff exponencial para 5xx.
  - Loguea latencia y status code.
  - No retransmite datos sensibles a servicios no necesarios (LLMs no reciben PII innecesaria).
- ✅ Pinning de versión de API: `META_GRAPH_VERSION=v21.0`. Subir versión = ADR.

---

## 9. CSP, CSRF, CORS

### Frontend (Next.js)
- ✅ CSP estricta vía middleware. Solo orígenes whitelisteados.
- ✅ Cookies con `SameSite=Lax` (Strict si no rompe Clerk).
- ✅ HSTS activado en producción.

### Backend (NestJS)
- ✅ CORS solo permite `WEB_URL` (`ALLOWED_ORIGINS` en env).
- ✅ `helmet` activado.
- ✅ Rate limit por IP y por user (Redis-based).

---

## 10. Dependencias

- ✅ `pnpm audit` corre en CI. Cualquier vuln "high" bloquea el merge.
- ✅ Renovate / Dependabot activado para PRs automáticos de updates.
- ✅ Lock file (`pnpm-lock.yaml`) **siempre** commiteado.
- ❌ No `npm install` ni `pnpm add` sin justificación. Cada dep nueva = revisión.

---

## 11. Producción

- ✅ Despliegues a producción requieren aprobación humana en GitHub Environment.
- ✅ Rollback en 1 click documentado en `docs/runbooks/rollback.md`.
- ✅ DB backups diarios, retention 30 días, restoración probada mensualmente.
- ✅ Monitoring activo: Sentry (errors), Better Stack (uptime), métricas de cola (BullMQ Board).
- ❌ No `pnpm db:reset` jamás contra producción. La CLI debe rechazar si `NODE_ENV=production`.

---

## 12. Reporte de incidentes

Si descubres una vulnerabilidad o incidente:

1. **No la pongas en un issue público de GitHub.** Comunicar por canal privado.
2. Crear ticket privado en el sistema interno con severidad (P0–P3).
3. P0/P1: convocar war-room en < 1h.
4. Postmortem en `docs/runbooks/postmortems/YYYY-MM-DD-titulo.md`.
5. Si hay afectación a clientes: notificación a despachos afectados en < 72h (LFPDPPP).
