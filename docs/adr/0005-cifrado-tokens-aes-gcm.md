# ADR 0005 — Cifrado de tokens de Meta y secretos sensibles

- **Estado:** Aceptado
- **Fecha:** 2026-05-06

## Contexto

Almacenamos tokens de página de Facebook e Instagram que dan acceso para leer comentarios y enviar DMs en nombre del despacho. Una fuga de la base de datos sin protección adicional permitiría a un atacante:

- Suplantar al despacho ante sus seguidores.
- Acceder a conversaciones privadas.
- Acumular violaciones que terminen en suspensión de la app Meta para todos los tenants.

## Decisión

**Toda credencial de tercero se cifra en columna con AES-256-GCM antes de persistir.**

**Esquema en dev:**
- Llave maestra única en `ENCRYPTION_KEY` (32 bytes hex, en `.env`, fuera de git).
- Cada cifrado genera IV aleatorio de 12 bytes; se almacena `iv:authTag:ciphertext` en base64.
- Helper `crypto/aesGcm.ts` con `encrypt(plaintext)` y `decrypt(payload)`.

**Esquema en producción:**
- KMS gestionado (Google Cloud KMS, AWS KMS o equivalente).
- Llave maestra **nunca** sale del KMS; se usa para envolver una DEK por tenant.
- Rotación trimestral de DEKs; las llaves viejas se conservan para descifrar histórico.
- Logs de uso del KMS auditables.

**Aplicación:**
- `SocialAccount.accessToken` y `refreshToken` son siempre ciphertext.
- `Tenant.metaWebhookSecret` igual.
- Stripe/Mercado Pago: usar IDs de cliente y referencias, nunca guardar números de tarjeta.

**Logs:**
- Helper `redactSecrets(obj)` aplicado antes de `logger.info`. Lista negra: `accessToken`, `refreshToken`, `password`, `apiKey`, `secret`, `authorization`.

## Alternativas rechazadas

- **TLS solo / "la DB está privada":** insuficiente. Defensa en capas.
- **Cifrado a nivel disco / TDE:** protege contra robo de disco, no contra dump de la DB.
- **AES-CBC:** sin autenticación; vulnerable a tampering.

## Consecuencias

**Positivas:**
- Una fuga de DB no es game-over inmediato.
- KMS provee auditoría de uso de llaves.
- Cumple buenas prácticas de la industria y facilita auditorías futuras (ISO 27001, SOC 2).

**Negativas:**
- KMS introduce costos pequeños y latencia de ms; aceptable.
- Hay que rotar correctamente — proceso documentado en runbook.
- Errores en el helper son catastróficos (datos perdidos); cobertura de tests unitarios obligatoria.

## Referencias

- `SECURITY.md` sección "Tokens"
- NIST SP 800-38D (GCM)
