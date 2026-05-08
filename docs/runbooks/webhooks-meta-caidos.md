# Runbook — Webhooks de Meta no llegan

**Severidad por defecto:** sev2 (función crítica afectada). Si afecta a más de un tenant: sev1.

## Síntomas

- No entran nuevos comentarios al inbox.
- `InboundEvent` deja de crecer en la base de datos.
- Sentry sin errores 5xx en `/webhooks/meta` — silencio.

## Diagnóstico (ordenado)

1. **¿Sigue arriba el endpoint?**
   ```bash
   curl -i https://api.tu-dominio/webhooks/meta?hub.mode=subscribe&hub.verify_token=$META_VERIFY_TOKEN&hub.challenge=ping
   ```
   Esperado: `200` con cuerpo `ping`.

2. **¿Suscripción activa en Meta?**  
   Meta for Developers → tu app → Webhooks → Page / Instagram. Verifica que los campos suscritos están y el endpoint resuelve OK.

3. **¿Token de página vivo?**  
   ```sql
   SELECT id, platform, needs_reauth, expires_at FROM social_accounts WHERE tenant_id = '<tenant>';
   ```
   Si `needs_reauth = true` → re-autenticar (ver paso 5).

4. **¿Logs muestran rechazo HMAC?**  
   Filtra `apps/api` por `webhook.signature.invalid`. Si aparece, el `META_APP_SECRET` no coincide.

5. **Re-autenticación de página**  
   Pide al despacho ir a `/settings/integrations` y reconectar la página. Verifica que el nuevo token vuelve cifrado a `social_accounts.access_token`.

## Acciones rápidas

- **Replay de eventos perdidos:** Meta retiene webhooks fallidos. Una vez resuelto, llamar `POST /webhooks/meta/replay` (admin only).
- **Backfill manual de comentarios:** worker `backfill-comments` toma `{ pageId, since, until }`.

## Causas históricas

| Fecha | Causa | Resolución |
| --- | --- | --- |
| (registrar al ocurrir) | | |
