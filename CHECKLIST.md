# CHECKLIST.md — Validación del setup

> Usa este checklist al final del Día 5, Día 10 y Día 14.
> Si algo falla, no avances. Resuélvelo antes.

---

## ✅ Hito 1 — Bootstrap (Día 5)

### Repositorio
- [ ] `git status` limpio (todo commiteado).
- [ ] `pnpm install` corre sin errores.
- [ ] `pnpm typecheck` verde en todos los paquetes.
- [ ] `pnpm lint` verde (warnings aceptables, errores no).
- [ ] `pnpm test` corre y pasa los placeholders.

### Infra local
- [ ] `pnpm db:up` levanta Postgres + Redis sin errores.
- [ ] `docker ps` muestra ambos contenedores `Up (healthy)`.
- [ ] Adminer accesible en http://localhost:8080.
- [ ] Conexión a Postgres funciona:
  ```bash
  docker exec -it legal-saas-postgres psql -U legal_saas -d legal_saas_dev -c "SELECT 1;"
  ```
- [ ] Extensiones instaladas:
  ```sql
  SELECT extname FROM pg_extension;
  -- Debe incluir: vector, pgcrypto, uuid-ossp, pg_trgm
  ```

### Apps
- [ ] `pnpm dev:api` levanta NestJS en :4000.
- [ ] `curl http://localhost:4000/health` devuelve `200` con `{ db: "ok", redis: "ok" }`.
- [ ] `pnpm dev:web` levanta Next.js en :3000.
- [ ] La home carga sin errores en consola.
- [ ] `pnpm dev:ai` levanta FastAPI en :8000.
- [ ] `curl http://localhost:8000/health` devuelve `{"status":"ok"}`.

### Auth (Clerk)
- [ ] Sign-up completo funciona.
- [ ] Crear organización en Clerk genera registro en `tenants`.
- [ ] Crear membership en Clerk genera registro en `memberships`.
- [ ] Endpoint protegido devuelve 401 sin token, 200 con token.

### Multi-tenancy
- [ ] RLS activado en todas las tablas con `tenant_id` (verificar con `\dp <tabla>` en psql).
- [ ] Test de aislamiento pasa:
  ```bash
  pnpm --filter @legal-saas/api test:rls
  ```
- [ ] `TenantContextInterceptor` registrado globalmente en `app.module.ts`.

---

## ✅ Hito 2 — Meta integration (Día 10)

### Cifrado
- [ ] `EncryptionService` implementado en `apps/api/src/common/encryption/`.
- [ ] Tests verdes: round-trip, tamper detection, wrong key.
- [ ] `ENCRYPTION_KEY` está en `.env` (no commiteada).

### Meta SDK
- [ ] `packages/meta-sdk` build verde.
- [ ] Métodos básicos: `getMe`, `getPages`, `getInstagramAccounts`, `subscribeWebhook`, `sendPrivateReply`.
- [ ] Errores tipados (no `Error` genérico).
- [ ] Tests con mocks pasan.

### OAuth flow
- [ ] Redirect a Facebook Login funciona.
- [ ] Callback intercambia code → long-lived token.
- [ ] Token persistido cifrado en `social_accounts`.
- [ ] Webhook subscription confirmado vía API:
  ```bash
  curl -G "https://graph.facebook.com/v21.0/{page_id}/subscribed_apps" \
       -d "access_token={page_token}"
  ```

### Webhook handler
- [ ] `GET /webhooks/meta` con verify token correcto devuelve el `challenge`.
- [ ] `POST /webhooks/meta` con firma válida devuelve 200.
- [ ] `POST /webhooks/meta` con firma inválida devuelve 403.
- [ ] Body raw correctamente parseado (no JSON parsed antes de HMAC).
- [ ] Idempotencia: enviar el mismo evento 2 veces solo lo procesa una vez.
- [ ] p99 de respuesta < 200ms (medir con `wrk` o similar).

### End-to-end manual
- [ ] Comentar en post de prueba de IG → en `apps/api` logs aparece el evento.
- [ ] Registro en `inbound_events` y luego en `comments`.

---

## ✅ Hito 3 — IA + Auto-reply (Día 14)

### AI service
- [ ] `POST /classify` recibe `{comment}` y devuelve JSON estructurado.
- [ ] Validación con Pydantic estricta.
- [ ] 20 comentarios reales clasificados con accuracy ≥ 80% en `area`.
- [ ] Latencia p50 < 800ms (con Haiku).
- [ ] Costo registrado en `ai_calls` después de cada llamada.

### Worker classify-intent
- [ ] Job se encola automáticamente al recibir comentario.
- [ ] Worker procesa y persiste resultado en `comments`.
- [ ] Si `intent_score >= 0.7`, encola `send-private-reply`.

### Worker send-private-reply
- [ ] Plantilla del tenant cargada según área.
- [ ] Variables sustituidas (`{{nombre}}` etc.).
- [ ] `metaSdk.sendPrivateReply` llamado correctamente con `messaging_type: 'RESPONSE'`.
- [ ] Manejo individual de errores 190, 200, 230, 551, 10903.
- [ ] Persistencia en `messages` con `meta_message_id`.
- [ ] Creación de `lead` y `conversation`.
- [ ] Audit log generado.

### Demo end-to-end (la prueba reina)
- [ ] Comentar "necesito asesoría sobre divorcio" en post de IG de prueba.
- [ ] En **menos de 60 segundos** el usuario recibe el DM con la plantilla del Abog. Óscar Miranda.
- [ ] El comentario aparece en `/inbox` del dashboard.
- [ ] Hay un nuevo `lead` con `area_legal: 'familiar'` y `stage: 'new'`.
- [ ] Audit log refleja: comment_received, classified, dm_sent.
- [ ] Sin errores en Sentry.

### Multi-tenant en Inbox
- [ ] Crear segundo tenant.
- [ ] Sus comentarios no aparecen en el inbox del primero.
- [ ] Verificado tanto via UI como via SQL directo.

---

## ✅ Limpieza final del Sprint 1+2

- [ ] `docs/adr/` tiene al menos 5 ADRs (uno por decisión arquitectónica grande tomada).
- [ ] `README.md` actualizado con cualquier cambio de proceso.
- [ ] Variables nuevas agregadas a `.env.example` y `turbo.json > globalEnv`.
- [ ] `pnpm audit` sin vulns "high" o "critical".
- [ ] CI verde en GitHub Actions.
- [ ] Backups de DB de dev probados (restore desde dump).
- [ ] Postmortem corto: ¿qué tomó más de lo esperado? Lecciones a `docs/runbooks/learnings.md`.

---

## Si algo falla — diagnóstico rápido

| Síntoma | Probable causa | Fix |
|---|---|---|
| `pnpm install` falla | Versión de pnpm o Node | Verificar `engines` en `package.json` |
| Postgres no levanta | Puerto 5432 en uso | `lsof -i :5432` y matar proceso |
| Webhook no llega | URL pública incorrecta o tunel caído | Reiniciar cloudflared, actualizar URL en Meta |
| Verify token rechazado | Mismatch entre `.env` y UI de Meta | Sincronizar y reiniciar `apps/api` |
| HMAC siempre falla | Body parseado antes del HMAC | Configurar Fastify `parseAs: 'buffer'` |
| RLS no aísla | `current_tenant_id` no seteado | Revisar `TenantContextInterceptor` y orden de middleware |
| Token de Meta expira | Long-lived no implementado | Verificar intercambio en callback OAuth |
| AI clasifica mal | Prompt o modelo equivocado | Ver `apps/ai/app/prompts/intent_v1.txt` y golden set |
