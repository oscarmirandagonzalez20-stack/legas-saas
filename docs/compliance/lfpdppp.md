# Cumplimiento LFPDPPP (México)

> Ley Federal de Protección de Datos Personales en Posesión de los Particulares.

Este documento es operacional, no constituye asesoría legal. Antes de salir a producción, **un abogado revisa y firma el aviso de privacidad y los contratos**.

## 1. Roles

- **Responsable** ante el INAI: cada despacho cliente, respecto a los datos de sus leads.
- **Encargado**: la empresa operadora del SaaS, respecto al tratamiento por cuenta del despacho. Se documenta en un contrato de prestación de servicios (encargo).

## 2. Datos personales que tratamos

| Categoría | Origen | Sensibilidad |
| --- | --- | --- |
| Nombre público FB/IG | Comentarios | Identificativo |
| Mensaje del lead | Comentarios y DMs | Posiblemente sensible (tema legal) |
| Teléfono/WhatsApp | Lead lo proporciona | Identificativo |
| Email | Lead lo proporciona | Identificativo |
| Datos del caso | Conversación con abogado | **Sensible** |

## 3. Aviso de privacidad

- Versión integral en el sitio del despacho (cada tenant configura el suyo).
- Versión simplificada referenciada en cada DM saliente automatizado.
- Plantilla disponible en `docs/compliance/plantillas/aviso-privacidad.md` (TODO).

## 4. Consentimiento

- **Tácito** para tratamiento ordinario (responder al comentario que el lead inició).
- **Expreso** para datos sensibles del caso — modal en la primera consulta.
- Persistido en `Consent`: `tenantId`, `leadId`, `purpose`, `grantedAt`, `evidence` (texto literal, hash de IP).

## 5. Derechos ARCO

Endpoint `POST /privacy/arco` (no autenticado, validado por email + token):

- **Acceso**: descargar todos los datos del titular en JSON.
- **Rectificación**: actualizar campos.
- **Cancelación**: soft delete y purga programada (30 días).
- **Oposición**: marcar `Lead.optedOut = true` y excluir de toda automatización.

SLA: 20 días hábiles para responder.

## 6. Transferencias

- Datos a Anthropic (clasificación): contemplado en aviso, transferencia "necesaria para prestación del servicio".
- Datos a Stripe / Mercado Pago: sólo billing del despacho, no de leads.
- Datos a Meta: bidireccional por la naturaleza del producto.

## 7. Seguridad

- Cifrado en reposo (Postgres) y en tránsito (TLS 1.2+).
- Tokens cifrados con AES-256-GCM (ver ADR 0005).
- Audit log append-only (`AuditLog`).
- Acceso administrativo con MFA.

## 8. Brecha de seguridad

Procedimiento si se confirma brecha:

1. Contener (revocar tokens, rotar llaves — ver runbook).
2. Evaluar alcance (qué datos, cuántos titulares, cuánto tiempo).
3. Notificar a tenants afectados < 72h.
4. Tenants notifican a titulares y al INAI según gravedad.
5. Postmortem en `docs/runbooks/postmortems/YYYY-MM-DD.md`.

## 9. Eliminación al cancelar tenant

Al cancelar suscripción: 30 días de retención por si reactivan, luego purga total — incluyendo respaldos al cumplir 90 días.

## Referencias

- Ley Federal de Protección de Datos Personales en Posesión de los Particulares (DOF 05/07/2010).
- Reglamento de la LFPDPPP.
- Lineamientos del Aviso de Privacidad (INAI).
