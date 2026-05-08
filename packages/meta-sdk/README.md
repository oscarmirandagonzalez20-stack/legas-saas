# @legal-saas/meta-sdk

Wrapper tipado de Meta Graph API v21.0 para Facebook e Instagram.

## Estado: implementación pendiente (Issue #13)

## Alcance Fase 1

- `oauth/` — exchange `code` → token de página de larga duración.
- `pages/` — listar páginas del usuario, suscribir a webhooks.
- `comments/` — leer comentario, responder público, ocultar, etiquetar.
- `messages/` — enviar DM en ventana 24h (Messenger) o Private Reply (7d desde comentario).
- `webhooks/` — verificación HMAC `X-Hub-Signature-256`, parser tipado de payloads.

## Reglas duras

- Versión bloqueada: `Graph API v21.0`. Cambio requiere ADR.
- Todo request: timeout 10s, 3 reintentos con backoff exponencial sólo en 5xx y 429.
- Mapeo de errores conocidos en `errors.ts`:
  - `190` token expirado → flag `SocialAccount.needsReauth`.
  - `200` permiso → log, alertar tenant.
  - `230` ventana cerrada → no reintentar, marcar conversación.
  - `551` 24h ventana Messenger → idem.
  - `10903` spam → cooldown del thread.
- Logs jamás imprimen `accessToken`.

## Pruebas

- Unit: mocks con `msw` o `nock`.
- Smoke contra cuenta de prueba real: en `apps/api` con flag `META_SMOKE_TEST=1`.
