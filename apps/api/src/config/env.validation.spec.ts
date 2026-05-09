import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  // Minimal required set — all optional vars are absent on purpose
  const base = {
    DATABASE_URL:   'postgresql://user:pass@localhost:5432/db',
    REDIS_URL:      'redis://localhost:6379',
    ENCRYPTION_KEY: 'a'.repeat(64),
  };

  it('accepts minimal env (only core vars set)', () => {
    const result = validateEnv(base);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('accepts production env without any external service vars', () => {
    const result = validateEnv({ ...base, NODE_ENV: 'production' });
    expect(result.NODE_ENV).toBe('production');
    // optional vars default to empty string — no crash
    expect(result.META_APP_ID).toBe('');
    expect(result.CLERK_SECRET_KEY).toBe('');
    expect(result.ANTHROPIC_API_KEY).toBe('');
    expect(result.STRIPE_SECRET_KEY).toBe('');
  });

  it('accepts all explicit values', () => {
    const result = validateEnv({
      ...base,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      FRONTEND_URL: 'https://app.example.com',
      META_APP_ID: 'app_id',
      META_APP_SECRET: 'app_secret',
      META_VERIFY_TOKEN: 'verify_token',
      META_REDIRECT_URI: 'https://api.example.com/callback',
      CLERK_SECRET_KEY: 'sk_live_test_key',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      STRIPE_SECRET_KEY: 'sk_live_stripe',
    });
    expect(result.NODE_ENV).toBe('production');
    expect(result.PORT).toBe(8080);
    expect(result.LOG_LEVEL).toBe('warn');
    expect(result.FRONTEND_URL).toBe('https://app.example.com');
  });

  it('coerces PORT string to number', () => {
    const result = validateEnv({ ...base, PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({ REDIS_URL: base.REDIS_URL, ENCRYPTION_KEY: base.ENCRYPTION_KEY }),
    ).toThrow('Environment validation failed');
  });

  it('throws when REDIS_URL is missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: base.DATABASE_URL, ENCRYPTION_KEY: base.ENCRYPTION_KEY }),
    ).toThrow('Environment validation failed');
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: base.DATABASE_URL, REDIS_URL: base.REDIS_URL }),
    ).toThrow('Environment validation failed');
  });

  it('throws when ENCRYPTION_KEY is wrong format', () => {
    expect(() =>
      validateEnv({ ...base, ENCRYPTION_KEY: 'tooshort' }),
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

  it('accepts empty string for FRONTEND_URL', () => {
    const result = validateEnv({ ...base, FRONTEND_URL: '' });
    expect(result.FRONTEND_URL).toBe('');
  });

  it('accepts valid URL for FRONTEND_URL', () => {
    const result = validateEnv({ ...base, FRONTEND_URL: 'https://app.example.com' });
    expect(result.FRONTEND_URL).toBe('https://app.example.com');
  });
});
