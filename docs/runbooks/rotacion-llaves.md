# Runbook — Rotación de llaves de cifrado

**Cadencia:** trimestral en producción. Antes si hay sospecha de compromiso.

## Pre-requisitos

- KMS configurado (Google Cloud KMS / AWS KMS).
- Acceso de admin a la consola del KMS y a la base de datos de producción (vía bastion).
- Ventana de mantenimiento anunciada al cliente (15-30 min).

## Procedimiento

### 1. Crear nueva DEK en KMS

```bash
gcloud kms keys versions create --location=... --keyring=... --key=legal-saas-tenant-dek
```

Anota el nuevo `versionId`. NO desactivar la versión anterior aún.

### 2. Re-cifrar columnas afectadas

Ejecutar el job `rotate-encryption-keys`:

```bash
pnpm --filter @legal-saas/api run jobs:rotate-keys --new-version=<versionId>
```

El job:
- Lee cada `SocialAccount` con la DEK vieja, descifra y re-cifra con la nueva DEK.
- Actualiza la columna `key_version` por fila.
- Procesa en lotes de 100 con commit por lote (idempotente — re-correr es seguro).

### 3. Verificar

```sql
SELECT key_version, COUNT(*) FROM social_accounts GROUP BY key_version;
```

Cuando el 100% esté en la nueva versión, continuar.

### 4. Deshabilitar versión vieja en KMS

Tras 7 días de gracia (por si hay backup que se necesite restaurar), deshabilitar — no destruir:

```bash
gcloud kms keys versions disable <viejaVersion> ...
```

Conservar 90 días, luego destruir.

## En caso de compromiso confirmado

- **No esperar al próximo trimestre.** Ejecutar inmediatamente.
- Tras la rotación, **revocar todos los tokens de página** y forzar re-OAuth a todos los tenants afectados (`UPDATE social_accounts SET needs_reauth = TRUE`).
- Notificar incidente a Anthropic Trust & Safety si los logs sugieren acceso indebido a datos.
- Notificar a tenants afectados según LFPDPPP (ver `docs/compliance/lfpdppp.md`).
