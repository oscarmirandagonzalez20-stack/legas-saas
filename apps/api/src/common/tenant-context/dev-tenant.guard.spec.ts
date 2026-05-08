import { type ExecutionContext, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevTenantGuard } from './dev-tenant.guard';

const VALID_UUID = 'a1b2c3d4-1234-4abc-89ef-000000000001';

function makeContext(
  headers: Record<string, string | string[] | undefined>,
  req: Record<string, unknown> = {},
): ExecutionContext {
  const request = { headers, tenantId: undefined, ...req };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('DevTenantGuard', () => {
  const guard = new DevTenantGuard();

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('production failsafe', () => {
    it('throws InternalServerErrorException when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const ctx = makeContext({ 'x-tenant-id': VALID_UUID });
      expect(() => guard.canActivate(ctx)).toThrow(InternalServerErrorException);
    });
  });

  describe('missing or invalid x-tenant-id', () => {
    it('throws UnauthorizedException when header is absent', () => {
      expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when header is empty string', () => {
      expect(() => guard.canActivate(makeContext({ 'x-tenant-id': '' }))).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when header is not a UUID', () => {
      expect(() => guard.canActivate(makeContext({ 'x-tenant-id': 'not-a-uuid' }))).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when UUID is malformed (too short)', () => {
      expect(() => guard.canActivate(makeContext({ 'x-tenant-id': '12345678-1234-1234-1234' }))).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when UUID contains invalid characters', () => {
      expect(() => guard.canActivate(makeContext({ 'x-tenant-id': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }))).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('valid x-tenant-id', () => {
    it('sets request.tenantId and returns true', () => {
      const request = { headers: { 'x-tenant-id': VALID_UUID }, tenantId: undefined };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(request.tenantId).toBe(VALID_UUID);
    });

    it('accepts lowercase UUID', () => {
      const request = { headers: { 'x-tenant-id': VALID_UUID.toLowerCase() }, tenantId: undefined };
      const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).not.toThrow();
      expect(request.tenantId).toBe(VALID_UUID.toLowerCase());
    });

    it('accepts uppercase UUID', () => {
      const request = { headers: { 'x-tenant-id': VALID_UUID.toUpperCase() }, tenantId: undefined };
      const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).not.toThrow();
    });

    it('uses the first value when header is an array', () => {
      const second = 'bbbbbbbb-0000-0000-0000-000000000002';
      const request = { headers: { 'x-tenant-id': [VALID_UUID, second] }, tenantId: undefined };
      const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

      guard.canActivate(ctx);

      expect(request.tenantId).toBe(VALID_UUID);
    });
  });
});
