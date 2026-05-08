import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { ZodError } from 'zod';
import { AppException, InfrastructureException } from '@/common/exceptions/app.exception';
import { isPermanentError } from './error-classification';

function makePrismaError(code: string, target?: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Prisma error', {
    code,
    clientVersion: '5.x',
    meta: target ? { target } : undefined,
  });
}

describe('isPermanentError', () => {
  describe('P2002 — unique constraint violations', () => {
    it('returns false for expected meta_message_id duplicate (idempotency path)', () => {
      expect(isPermanentError(makePrismaError('P2002', ['meta_message_id']))).toBe(false);
    });

    it('returns true for unexpected P2002 on other field', () => {
      expect(isPermanentError(makePrismaError('P2002', ['external_user_id']))).toBe(true);
    });

    it('returns true for P2002 with no target metadata', () => {
      expect(isPermanentError(makePrismaError('P2002'))).toBe(true);
    });

    it('returns true for P2002 with target that mixes expected and other fields', () => {
      expect(isPermanentError(makePrismaError('P2002', ['meta_message_id', 'something_else']))).toBe(false);
    });
  });

  describe('other Prisma errors', () => {
    it('returns true for P2003 (FK constraint violation)', () => {
      expect(isPermanentError(makePrismaError('P2003'))).toBe(true);
    });

    it('returns true for P2025 (record not found)', () => {
      expect(isPermanentError(makePrismaError('P2025'))).toBe(true);
    });

    it('returns false for P2002-adjacent transient Prisma errors (e.g. P2024 timeout)', () => {
      expect(isPermanentError(makePrismaError('P2024'))).toBe(false);
    });
  });

  describe('ZodError', () => {
    it('returns true for ZodError', () => {
      let err: ZodError | null = null;
      try {
        z.string().parse(42);
      } catch (e) {
        err = e as ZodError;
      }
      expect(err).not.toBeNull();
      expect(isPermanentError(err)).toBe(true);
    });
  });

  describe('AppException', () => {
    it('returns true for TENANT_CONTEXT_MISSING', () => {
      expect(isPermanentError(new InfrastructureException('TENANT_CONTEXT_MISSING', 'msg'))).toBe(true);
    });

    it('returns true for TENANT_ID_INVALID', () => {
      expect(isPermanentError(new InfrastructureException('TENANT_ID_INVALID', 'msg'))).toBe(true);
    });

    it('returns false for other AppException codes', () => {
      expect(isPermanentError(new AppException(422, 'SOME_OTHER_CODE', 'msg'))).toBe(false);
    });
  });

  describe('transient errors', () => {
    it('returns false for generic Error', () => {
      expect(isPermanentError(new Error('Network timeout'))).toBe(false);
    });

    it('returns false for string throws', () => {
      expect(isPermanentError('connection refused')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isPermanentError(null)).toBe(false);
    });
  });
});
