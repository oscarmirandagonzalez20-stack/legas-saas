import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { InfrastructureException } from '@/common/exceptions/app.exception';
import type { WebhookEvent } from '../dto/webhook-event.dto';
import type { JobLogContext } from '../dto/job-log-context.dto';
import { CommentIngestionService, STALE_PROCESSING_THRESHOLD_MS } from './comment-ingestion.service';
import type { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import type { PrismaService } from '@/prisma/prisma.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const SOCIAL_ACCOUNT_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const IDEMPOTENCY_KEY = 'FACEBOOK:comment_123';

const SAMPLE_EVENT: WebhookEvent = {
  type: 'COMMENT',
  platform: 'FACEBOOK',
  externalId: 'comment_123',
  pageId: 'page_456',
  postId: 'post_789',
  parentCommentId: null,
  text: 'Quiero asesoría',
  from: { externalUserId: 'fb_user_001', name: 'Juan Pérez' },
  timestamp: new Date('2024-01-01T00:00:00Z'),
  raw: {},
};

const LOG_CTX: JobLogContext = {
  jobId: 'test-job',
  attempt: 1,
  tenantId: TENANT_ID,
  platform: 'FACEBOOK',
  externalId: 'comment_123',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function makePrisma(overrides: {
  queryRaw?: ReturnType<typeof vi.fn>;
  executeRaw?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const queryRaw = overrides.queryRaw ?? vi.fn<() => Promise<{ id: string }[]>>().mockResolvedValue([{ id: 'evt-1' }]);
  const executeRaw = overrides.executeRaw ?? vi.fn<() => Promise<number>>().mockResolvedValue(0);
  const update = overrides.update ?? vi.fn<() => Promise<unknown>>().mockResolvedValue({});
  return {
    mock: { queryRaw, executeRaw, update },
    prisma: {
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
      inboundEvent: { update },
    } as unknown as PrismaService,
  };
}

function makeTenantContext(tenantId: string | null) {
  const getContext = vi.fn<() => { tenantId: string } | null>().mockReturnValue(
    tenantId !== null ? { tenantId } : null,
  );
  return {
    getContext,
    service: { getContext } as unknown as TenantContextService,
  };
}

function makeTenantPrisma() {
  const run = vi.fn<(fn: (tx: unknown) => Promise<void>) => Promise<void>>().mockResolvedValue(undefined);
  return {
    run,
    service: { run } as unknown as TenantPrismaService,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('CommentIngestionService', () => {
  describe('claimEvent', () => {
    let service: CommentIngestionService;
    let queryRaw: ReturnType<typeof vi.fn>;
    let executeRaw: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const p = makePrisma({ queryRaw: vi.fn<() => Promise<{ id: string }[]>>().mockResolvedValue([{ id: 'evt-1' }]) });
      queryRaw = p.mock.queryRaw;
      executeRaw = p.mock.executeRaw;
      const { service: tc } = makeTenantContext(TENANT_ID);
      const { service: tp } = makeTenantPrisma();
      service = new CommentIngestionService(tp, tc, p.prisma);
    });

    it('returns "claimed" when the UPDATE touches a row', async () => {
      const result = await service.claimEvent(IDEMPOTENCY_KEY, SAMPLE_EVENT);
      expect(result).toBe('claimed');
    });

    it('returns "skip" when UPDATE touches no rows (another worker holds claim)', async () => {
      queryRaw.mockResolvedValue([]);
      const result = await service.claimEvent(IDEMPOTENCY_KEY, SAMPLE_EVENT);
      expect(result).toBe('skip');
    });

    it('runs the INSERT upsert before the UPDATE claim', async () => {
      const callOrder: string[] = [];
      executeRaw.mockImplementation(() => { callOrder.push('insert'); return Promise.resolve(0); });
      queryRaw.mockImplementation(() => { callOrder.push('update'); return Promise.resolve([{ id: 'e' }]); });

      await service.claimEvent(IDEMPOTENCY_KEY, SAMPLE_EVENT);

      expect(callOrder).toEqual(['insert', 'update']);
    });

    it('passes a stale cutoff Date that reflects STALE_PROCESSING_THRESHOLD_MS', async () => {
      const before = Date.now() - STALE_PROCESSING_THRESHOLD_MS;
      await service.claimEvent(IDEMPOTENCY_KEY, SAMPLE_EVENT);
      const after = Date.now() - STALE_PROCESSING_THRESHOLD_MS;

      // Tagged template args: [TemplateStringsArray, idempotencyKey, staleCutoff]
      const callArgs = queryRaw.mock.calls[0] as unknown[];
      const dateArg = callArgs.find((a): a is Date => a instanceof Date);
      expect(dateArg).toBeInstanceOf(Date);
      const ts = dateArg?.getTime() ?? 0;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after + 100); // 100ms grace
    });
  });

  describe('ingest', () => {
    it('skips processing entirely when claim returns "skip"', async () => {
      const p = makePrisma({ queryRaw: vi.fn<() => Promise<{ id: string }[]>>().mockResolvedValue([]) });
      const { service: tc } = makeTenantContext(TENANT_ID);
      const tp = makeTenantPrisma();
      const service = new CommentIngestionService(tp.service, tc, p.prisma);

      await service.ingest(SAMPLE_EVENT, SOCIAL_ACCOUNT_ID, LOG_CTX);

      expect(tp.run).not.toHaveBeenCalled();
    });

    it('calls tenantPrisma.run and marks event PROCESSED on success', async () => {
      const p = makePrisma({});
      const { service: tc } = makeTenantContext(TENANT_ID);
      const tp = makeTenantPrisma();
      const service = new CommentIngestionService(tp.service, tc, p.prisma);

      await service.ingest(SAMPLE_EVENT, SOCIAL_ACCOUNT_ID, LOG_CTX);

      expect(tp.run).toHaveBeenCalledOnce();
      expect(p.mock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('marks event FAILED and rethrows when processing throws', async () => {
      const p = makePrisma({});
      const { service: tc } = makeTenantContext(TENANT_ID);
      const boom = new Error('Timeout');
      const tp = makeTenantPrisma();
      tp.run.mockRejectedValue(boom);
      const service = new CommentIngestionService(tp.service, tc, p.prisma);

      await expect(service.ingest(SAMPLE_EVENT, SOCIAL_ACCOUNT_ID, LOG_CTX)).rejects.toThrow('Timeout');

      expect(p.mock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Timeout' }),
        }),
      );
    });

    it('throws InfrastructureException when tenant context is absent', async () => {
      const p = makePrisma({});
      const { service: tc } = makeTenantContext(null);
      const { service: tp } = makeTenantPrisma();
      const service = new CommentIngestionService(tp, tc, p.prisma);

      await expect(service.ingest(SAMPLE_EVENT, SOCIAL_ACCOUNT_ID, LOG_CTX)).rejects.toThrow(
        InfrastructureException,
      );
    });
  });
});
