import { z } from 'zod';

const envSchema = z.object({
  // ── Core — required, crash on missing ──────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Must be a real postgresql:// URL — rejects Railway placeholder strings like ${{Postgres.DATABASE_URL}}
  // which would otherwise crash the Prisma constructor with an opaque "Invalid URL scheme" error.
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .regex(
      /^postgres(?:ql)?:\/\/.+/,
      'DATABASE_URL must be a valid PostgreSQL URL (e.g. postgresql://user:pass@host:5432/db)',
    ),

  REDIS_URL: z
    .string({ required_error: 'REDIS_URL is required' })
    .regex(
      /^rediss?:\/\/.+/,
      'REDIS_URL must be a valid Redis URL (e.g. redis://host:6379 or rediss://host:6379)',
    ),

  // Empty string is allowed so the server can boot and pass the healthcheck even
  // when the key is not yet configured. CryptoService will throw at call-time.
  ENCRYPTION_KEY: z.union([
    z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes AES-256)'),
    z.literal(''),
  ]).default(''),

  // ── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // ── URLs — optional; empty string accepted so Railway deploys without them ───
  FRONTEND_URL:    z.string().url().or(z.literal('')).default(''),
  API_URL:         z.string().url().or(z.literal('')).default(''),
  WEB_URL:         z.string().url().optional().or(z.literal('')),
  AI_SERVICE_URL:  z.string().url().optional().or(z.literal('')),

  // ── Meta / Facebook — optional, features degrade gracefully when absent ─────
  META_APP_ID:      z.string().default(''),
  META_APP_SECRET:  z.string().default(''),
  META_VERIFY_TOKEN: z.string().default(''),
  META_REDIRECT_URI: z.string().default(''),

  // ── Auth — optional in non-production; required later when Clerk is wired ───
  CLERK_SECRET_KEY:       z.string().default(''),
  CLERK_PUBLISHABLE_KEY:  z.string().default(''),

  // ── AI providers — optional, classify/embed features degrade when absent ────
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY:    z.string().default(''),

  // ── Payments — optional until billing is wired up ───────────────────────────
  STRIPE_SECRET_KEY:        z.string().default(''),
  STRIPE_WEBHOOK_SECRET:    z.string().default(''),
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),

  // ── Observability — optional, no-op when absent ─────────────────────────────
  SENTRY_DSN:         z.string().url().optional().or(z.literal('')),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // ── CORS — optional, falls back to FRONTEND_URL ─────────────────────────────
  CORS_ORIGINS: z.string().optional(),

  // ── Meta Safety — enterprise-grade protection layer ──────────────────────────
  // SAFE_MODE=true blocks all outgoing automation (default: true).
  // Only "false" or "0" disables it — any other value keeps it enabled.
  SAFE_MODE: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),

  META_AUTOMATION_MODE: z
    .enum(['MANUAL', 'SEMI_AUTOMATIC', 'SAFE_AUTOMATIC'])
    .default('MANUAL'),

  // Per-account message rate limits — human-realistic maximums
  META_MAX_MSG_PER_MIN:              z.coerce.number().int().min(1).max(10).default(2),
  META_MAX_MSG_PER_HOUR:             z.coerce.number().int().min(1).max(120).default(30),
  META_MAX_MSG_PER_DAY:              z.coerce.number().int().min(1).max(500).default(200),
  META_MAX_DMS_PER_HOUR:             z.coerce.number().int().min(1).max(60).default(20),
  META_MAX_COMMENT_REPLIES_PER_HOUR: z.coerce.number().int().min(1).max(60).default(30),
  META_MAX_RESPONSES_PER_USER:       z.coerce.number().int().min(1).max(10).default(3),
  META_MAX_RESPONSES_PER_CONV:       z.coerce.number().int().min(1).max(10).default(5),

  // Humanization — random delay range in milliseconds between responses
  META_HUMANIZATION_MIN_DELAY_MS: z.coerce.number().int().min(5_000).default(20_000),
  META_HUMANIZATION_MAX_DELAY_MS: z.coerce.number().int().min(10_000).default(180_000),

  // Circuit breaker — auto-pauses an account after N consecutive Meta errors
  META_CB_THRESHOLD:  z.coerce.number().int().min(1).max(20).default(3),
  META_CB_TIMEOUT_MS: z.coerce.number().int().min(60_000).default(900_000), // 15 min
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
