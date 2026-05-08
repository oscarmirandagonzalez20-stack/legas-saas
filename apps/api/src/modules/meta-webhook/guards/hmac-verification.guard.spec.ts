import { createHmac } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.validation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HmacVerificationGuard } from './hmac-verification.guard';

const APP_SECRET = 'test_app_secret_1234';

function makeSignature(body: Buffer, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function makeContext(
  rawBody: Buffer | undefined,
  signature: string | undefined,
): ExecutionContext {
  const request = {
    rawBody,
    headers: { 'x-hub-signature-256': signature },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeGuard(secret = APP_SECRET): HmacVerificationGuard {
  const config = {
    get: vi.fn((_key: string) => secret),
  } as unknown as ConfigService<Env, true>;
  return new HmacVerificationGuard(config);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('HmacVerificationGuard', () => {
  let guard: HmacVerificationGuard;

  beforeEach(() => {
    guard = makeGuard();
  });

  it('returns true for a valid HMAC signature', () => {
    const body = Buffer.from('{"object":"page"}');
    const ctx = makeContext(body, makeSignature(body));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when rawBody is missing', () => {
    const ctx = makeContext(undefined, 'sha256=abc');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when signature header is missing', () => {
    const body = Buffer.from('{}');
    const ctx = makeContext(body, undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when signature lacks sha256= prefix', () => {
    const body = Buffer.from('{}');
    const ctx = makeContext(body, 'abc123');
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when HMAC does not match', () => {
    const body = Buffer.from('{"object":"page"}');
    const ctx = makeContext(body, makeSignature(body, 'wrong_secret'));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when body is tampered after signing', () => {
    const original = Buffer.from('{"object":"page"}');
    const tampered = Buffer.from('{"object":"instagram"}');
    const ctx = makeContext(tampered, makeSignature(original));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('accepts binary body (non-UTF8) correctly', () => {
    const body = Buffer.from([0x7b, 0x7d]);   // "{}"
    const ctx = makeContext(body, makeSignature(body));
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
