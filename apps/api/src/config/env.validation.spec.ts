import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    META_APP_ID: 'test_app_id',
    META_APP_SECRET: 'test_app_secret',
    META_VERIFY_TOKEN: 'test_verify_token',
    META_REDIRECT_URI: 'https://api.example.com/callback',
    ENCRYPTION_KEY: 'a'.repeat(64),
    FRONTEND_URL: 'https://app.example.com',
  };

  it('accepts valid env with defaults', () => {
    const result = validateEnv(base);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(4000);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('accepts all explicit values in production when CLERK_SECRET_KEY is present', () => {
    const result = validateEnv({
      ...base,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CLERK_SECRET_KEY: 'sk_live_test_key',
    });
    expect(result.NODE_ENV).toBe('production');
    expect(result.PORT).toBe(8080);
    expect(result.LOG_LEVEL).toBe('warn');
  });

  it('coerces PORT string to number', () => {
    const result = validateEnv({ ...base, PORT: '3000' });
    expect(result.PORT).toBe(3000);
    expect(typeof result.PORT).toBe('number');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({ REDIS_URL: base.REDIS_URL }),
    ).toThrow('Environment validation failed');
  });

  it('throws when REDIS_URL is missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: base.DATABASE_URL }),
    ).toThrow('Environment validation failed');
  });

  it('throws when NODE_ENV is invalid', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'staging' }),
    ).toThrow('Environment validation failed');
  });

  it('throws when LOG_LEVEL is invalid', () => {
    expect(() =>
      validateEnv({ ...base, LOG_LEVEL: 'verbose' }),
    ).toThrow('Environment validation failed');
  });

  it('throws when NODE_ENV is production and CLERK_SECRET_KEY is absent', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production' }),
    ).toThrow('CLERK_SECRET_KEY is required in production');
  });
});
