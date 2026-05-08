# ADR 0003 — Integración Meta vía Graph API oficial (FB + IG)

- **Estado:** Aceptado
- **Fecha:** 2026-05-06

## Contexto

El producto convierte comentarios públicos de Facebook e Instagram en DMs privados con leads. Existen dos caminos:

1. APIs oficiales de Meta (Graph API + Webhooks + Messenger Platform + Instagram Messaging).
2. Automatizaciones no oficiales (scraping, bots de navegador, APIs de terceros que prometen "saltarse" límites).

## Decisión

**Sólo APIs oficiales de Meta**, App Review formal, cumplimiento estricto de policies. Versión actual: **Graph API v21.0**.

Permisos requeridos para Fase 1:
- `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`
- `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `instagram_business_manage_messages`
- `business_management`

Mecánicas:
- Webhooks suscritos a `feed`, `comments`, `messages`, `messaging_postbacks`.
- Verificación HMAC `X-Hub-Signature-256` con `META_APP_SECRET`.
- Respuesta 200 al webhook en <200ms; trabajo real en BullMQ.
- **Private Reply** sólo dentro de la ventana de **7 días** desde el comentario.
- **Messenger** sigue ventana **24 horas** post-última interacción del usuario.
- Tokens de acceso a páginas cifrados con AES-256-GCM (KMS en producción).

## Alternativas rechazadas

- **Scraping / Selenium / Puppeteer en cuentas reales:** viola TOS, suspensión de cuentas, riesgo legal para los despachos clientes.
- **APIs no oficiales tipo "bot warmup":** mismo problema, además inestables.
- **Whatsapp Business no oficial:** cero. WhatsApp Business Cloud API más adelante (Fase 2+).

## Consecuencias

**Positivas:**
- Producto vendible y defendible legalmente.
- Estable: sólo cambios cuando Meta deprecia versiones (cada ~12 meses).
- Posibilidad de pasar App Review y operar a escala.

**Negativas:**
- App Review puede tomar 2-6 semanas en primera ronda. Iniciar temprano.
- Restricciones de ventana 7d / 24h limitan creatividad — el producto debe abrazarlas, no esquivarlas.
- Algunos errores recurrentes (190 token expirado, 200 permiso, 230 ventana cerrada, 551 fuera de 24h, 10903 spam) requieren manejo específico.

## Referencias

- https://developers.facebook.com/docs/graph-api/
- https://developers.facebook.com/docs/messenger-platform/policy/policy-overview
- `CLAUDE.md` sección "Reglas Meta Graph"
