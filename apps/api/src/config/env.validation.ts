import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    META_APP_ID: z.string().min(1, 'META_APP_ID is required'),
    META_APP_SECRET: z.string().min(1, 'META_APP_SECRET is required'),
    META_VERIFY_TOKEN: z.string().min(1, 'META_VERIFY_TOKEN is required'),
    META_REDIRECT_URI: z.string().url('META_REDIRECT_URI must be a valid URL'),

    ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes AES-256)'),

    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

    // Optional: comma-separated additional CORS origins (defaults to FRONTEND_URL if absent)
    CORS_ORIGINS: z.string().optional(),

    // Required in production — empty string accepted only in dev/test (Clerk bypass mode)
    CLERK_SECRET_KEY: z.string().default(''),

    // Optional: Sentry error tracking
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.CLERK_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CLERK_SECRET_KEY is required in production',
        path: ['CLERK_SECRET_KEY'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
