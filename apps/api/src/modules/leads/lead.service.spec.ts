import type { Lead, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import type { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import { LeadService } from './lead.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

// ── mock helpers ─────────────────────────────────────────────────────────────

function makeMockTx() {
  const findMany = vi.fn<() => Promise<Lead[]>>();
  const count = vi.fn<() => Promise<number>>();
  const create = vi.fn<(arg: { data: unknown }) => Promise<Lead>>();
  const tx = { lead: { findMany, count, create } } as unknown as Prisma.TransactionClient;
  return { tx, findMany, count, create };
}

function makeMockTenantPrisma(tx: Prisma.TransactionClient): TenantPrismaService {
  return {
    run: vi.fn(<T>(fn: (t: Prisma.TransactionClient) => Promise<T>) => fn(tx)),
  } as unknown as TenantPrismaService;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LeadService', () => {
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
  });

  describe('list()', () => {
    it('calls tx.lead.findMany ordered by createdAt desc', async () => {
      const { tx, findMany, count } = makeMockTx();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.list({ page: 1, limit: 20 }),
      );

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns the data array produced by tx.lead.findMany', async () => {
      const leads = [{ id: 'lead-1' }, { id: 'lead-2' }] as Lead[];
      const { tx, findMany, count } = makeMockTx();
      findMany.mockResolvedValue(leads);
      count.mockResolvedValue(2);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      const result = await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.list({ page: 1, limit: 20 }),
      );

      expect(result.data).toBe(leads);
      expect(result.total).toBe(2);
    });

    it('returns an empty data array when there are no leads', async () => {
      const { tx, findMany, count } = makeMockTx();
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      const result = await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.list({ page: 1, limit: 20 }),
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('create()', () => {
    it('calls tx.lead.create with tenantId from ALS context', async () => {
      const { tx, create } = makeMockTx();
      create.mockResolvedValue({ id: 'new' } as Lead);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.create({ externalUserId: 'fb_user_123' }),
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID }) }),
      );
    });

    it('calls tx.lead.create with externalUserId from dto', async () => {
      const { tx, create } = makeMockTx();
      create.mockResolvedValue({ id: 'new' } as Lead);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.create({ externalUserId: 'fb_user_456' }),
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ externalUserId: 'fb_user_456' }) }),
      );
    });

    it('passes optional dto fields when provided', async () => {
      const { tx, create } = makeMockTx();
      create.mockResolvedValue({ id: 'new' } as Lead);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.create({
          externalUserId: 'fb_user_789',
          displayName: 'María García',
          areaLegal: 'familiar',
          email: 'maria@example.com',
        }),
      );

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'María García',
            areaLegal: 'familiar',
            email: 'maria@example.com',
          }),
        }),
      );
    });

    it('returns the lead produced by tx.lead.create', async () => {
      const created = { id: 'lead-abc', tenantId: TENANT_ID } as Lead;
      const { tx, create } = makeMockTx();
      create.mockResolvedValue(created);
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      const result = await tenantContext.run({ tenantId: TENANT_ID }, () =>
        svc.create({ externalUserId: 'fb_user_123' }),
      );

      expect(result).toBe(created);
    });

    it('throws TENANT_CONTEXT_MISSING when there is no ALS context', async () => {
      const { tx } = makeMockTx();
      const svc = new LeadService(makeMockTenantPrisma(tx), tenantContext);

      await expect(svc.create({ externalUserId: 'fb_user' })).rejects.toMatchObject({
        errorCode: 'TENANT_CONTEXT_MISSING',
      });
    });
  });
});
