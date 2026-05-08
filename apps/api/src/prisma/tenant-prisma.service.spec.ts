import { InfrastructureException } from '@/common/exceptions/app.exception';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

const VALID_UUID = 'a1b2c3d4-1234-4abc-89ef-000000000001';

// ── mock helpers ────────────────────────────────────────────────────────────

function makeMockPrisma(capturedSQL?: string[]): {
  mockPrisma: PrismaService;
  mockTx: Prisma.TransactionClient;
} {
  const mockTx = {
    $executeRawUnsafe: vi.fn((sql: string) => {
      capturedSQL?.push(sql);
      return Promise.resolve();
    }),
  } as unknown as Prisma.TransactionClient;

  const mockPrisma = {
    $transaction: vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(mockTx),
    ),
  } as unknown as PrismaService;

  return { mockPrisma, mockTx };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('TenantPrismaService', () => {
  const tenantSvc = new TenantContextService();

  describe('run() — missing or invalid context', () => {
    it('throws InfrastructureException when there is no tenant context in ALS', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await expect(svc.run(() => Promise.resolve(null))).rejects.toThrow(InfrastructureException);
    });

    it('error code is TENANT_CONTEXT_MISSING when ALS has no context', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await expect(svc.run(() => Promise.resolve(null))).rejects.toMatchObject({
        errorCode: 'TENANT_CONTEXT_MISSING',
      });
    });

    it('throws InfrastructureException when tenantId in ALS is not a valid UUID', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await tenantSvc.run({ tenantId: 'not-a-uuid' }, async () => {
        await expect(svc.run(() => Promise.resolve(null))).rejects.toMatchObject({
          errorCode: 'TENANT_ID_INVALID',
        });
      });
    });

    it('throws TENANT_ID_INVALID for a SQL injection attempt via tenantId', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await tenantSvc.run({ tenantId: "'; DROP TABLE tenants; --" }, async () => {
        await expect(svc.run(() => Promise.resolve(null))).rejects.toMatchObject({
          errorCode: 'TENANT_ID_INVALID',
        });
      });
    });
  });

  describe('run() — correct execution', () => {
    it('passes the SET LOCAL SQL with the tenantId from ALS', async () => {
      const capturedSQL: string[] = [];
      const { mockPrisma } = makeMockPrisma(capturedSQL);
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await tenantSvc.run({ tenantId: VALID_UUID }, async () => {
        await svc.run(() => Promise.resolve(null));
      });

      expect(capturedSQL).toHaveLength(1);
      expect(capturedSQL[0]).toBe(`SET LOCAL app.current_tenant_id = '${VALID_UUID}'`);
    });

    it('executes SET LOCAL before calling fn', async () => {
      const orderLog: string[] = [];

      const mockTx = {
        $executeRawUnsafe: vi.fn((_sql: string) => {
          orderLog.push('SET_LOCAL');
          return Promise.resolve();
        }),
      } as unknown as Prisma.TransactionClient;

      const mockPrisma = {
        $transaction: vi.fn(
          async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(mockTx),
        ),
      } as unknown as PrismaService;

      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      await tenantSvc.run({ tenantId: VALID_UUID }, async () => {
        await svc.run(() => {
          orderLog.push('CALLBACK');
          return Promise.resolve(null);
        });
      });

      expect(orderLog).toEqual(['SET_LOCAL', 'CALLBACK']);
    });

    it('calls fn with the Prisma transaction client', async () => {
      const { mockPrisma, mockTx } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);
      let receivedTx: Prisma.TransactionClient | undefined;

      await tenantSvc.run({ tenantId: VALID_UUID }, async () => {
        await svc.run((tx) => {
          receivedTx = tx;
          return Promise.resolve(null);
        });
      });

      expect(receivedTx).toBe(mockTx);
    });

    it('returns the value produced by fn', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);

      const result = await tenantSvc.run({ tenantId: VALID_UUID }, async () =>
        svc.run(() => Promise.resolve('expected-value')),
      );

      expect(result).toBe('expected-value');
    });

    it('propagates errors thrown inside fn', async () => {
      const { mockPrisma } = makeMockPrisma();
      const svc = new TenantPrismaService(mockPrisma, tenantSvc);
      const boom = new Error('fn exploded');

      await tenantSvc.run({ tenantId: VALID_UUID }, async () => {
        await expect(svc.run(() => Promise.reject(boom))).rejects.toThrow(boom);
      });
    });
  });

  describe('run() — ALS isolation between concurrent executions', () => {
    it('uses the correct tenantId per ALS context when called concurrently', async () => {
      const idA = 'aaaaaaaa-0000-0000-0000-000000000001';
      const idB = 'bbbbbbbb-0000-0000-0000-000000000002';
      const sqlsA: string[] = [];
      const sqlsB: string[] = [];

      const txA = {
        $executeRawUnsafe: vi.fn(async (sql: string) => {
          sqlsA.push(sql);
          await new Promise<void>((r) => setTimeout(r, 5));
        }),
      } as unknown as Prisma.TransactionClient;

      const txB = {
        $executeRawUnsafe: vi.fn(async (sql: string) => {
          sqlsB.push(sql);
          await new Promise<void>((r) => setTimeout(r, 5));
        }),
      } as unknown as Prisma.TransactionClient;

      const mockedPrismaA = {
        $transaction: vi.fn(
          async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(txA),
        ),
      } as unknown as PrismaService;

      const mockedPrismaB = {
        $transaction: vi.fn(
          async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(txB),
        ),
      } as unknown as PrismaService;

      const svcA = new TenantPrismaService(mockedPrismaA, tenantSvc);
      const svcB = new TenantPrismaService(mockedPrismaB, tenantSvc);

      await Promise.all([
        tenantSvc.run({ tenantId: idA }, () => svcA.run(() => Promise.resolve(null))),
        tenantSvc.run({ tenantId: idB }, () => svcB.run(() => Promise.resolve(null))),
      ]);

      expect(sqlsA).toHaveLength(1);
      expect(sqlsA[0]).toContain(idA);
      expect(sqlsA[0]).not.toContain(idB);

      expect(sqlsB).toHaveLength(1);
      expect(sqlsB[0]).toContain(idB);
      expect(sqlsB[0]).not.toContain(idA);
    });
  });
});
