import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppException } from '@/common/exceptions/app.exception';

// Unique constraint field targets that indicate successful idempotency (not a real error)
const IDEMPOTENT_P2002_FIELDS = new Set(['meta_message_id']);

// AppException error codes that indicate a permanent configuration/data problem
const PERMANENT_APP_ERROR_CODES = new Set([
  'TENANT_CONTEXT_MISSING',
  'TENANT_ID_INVALID',
]);

/**
 * Returns true when retrying would never succeed.
 * - Expected P2002 on meta_message_id = message already exists = idempotency success path
 * - Unexpected P2002 (other unique violations) = data integrity problem = permanent
 * - P2003 (FK violation), P2025 (record not found) = permanent
 * - ZodError = schema mismatch = permanent
 * - Known domain errors (TENANT_CONTEXT_MISSING, TENANT_ID_INVALID) = permanent
 * - Everything else = transient (network, DB unavailability, etc.)
 */
export function isPermanentError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      const fields: unknown[] = Array.isArray(target) ? target : [target];
      // Expected dedup — another concurrent worker already created the message → success
      if (fields.some((f) => typeof f === 'string' && IDEMPOTENT_P2002_FIELDS.has(f))) {
        return false;
      }
      return true;
    }
    return err.code === 'P2003' || err.code === 'P2025';
  }

  if (err instanceof ZodError) return true;

  if (err instanceof AppException) {
    return PERMANENT_APP_ERROR_CODES.has(err.errorCode);
  }

  return false;
}
