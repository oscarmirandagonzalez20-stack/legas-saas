import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { InfrastructureException } from '@/common/exceptions/app.exception';
import { WEBHOOK_JOB_COMMENT, type WebhookJobPayload } from '../dto/webhook-job.dto';
import type { WebhookEvent } from '../dto/webhook-event.dto';
import { CommentIngestionWorker, type JobLogContext } from './comment-ingestion.worker';
import type { CommentIngestionService } from './comment-ingestion.service';

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const SOCIAL_ACCOUNT_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const SAMPLE_EVENT: WebhookEvent = {
  type: 'COMMENT',
  platform: 'FACEBOOK',
  externalId: 'comment_123',
  pageId: 'page_456',
  postId: 'post_789',
  parentCommentId: null,
  text: 'Necesito asesoría familiar',
  from: { externalUserId: 'fb_user_001', name: 'María García' },
  timestamp: new Date('2024-01-01T00:00:00Z'),
  raw: {},
};

const CORRELATION_ID = 'cccccccc-0000-0000-0000-000000000099';

function makeJobData(overrides: Partial<WebhookJobPayload> = {}): WebhookJobPayload {
  return {
    tenantId: TENANT_ID,
    socialAccountId: SOCIAL_ACCOUNT_ID,
    event: SAMPLE_EVENT,
    receivedAt: new Date().toISOString(),
    correlationId: CORRELATION_ID,
    ...overrides,
  };
}

function makeJob(name: string = WEBHOOK_JOB_COMMENT, overrides: Partial<WebhookJobPayload> = {}): Job<WebhookJobPayload> {
  return { name, id: 'job-001', attemptsMade: 0, data: makeJobData(overrides) } as unknown as Job<WebhookJobPayload>;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CommentIngestionWorker', () => {
  let tenantContext: TenantContextService;
  let ingest: ReturnType<typeof vi.fn<(event: WebhookEvent, socialAccountId: string, logCtx: JobLogContext) => Promise<void>>>;
  let ingestionService: CommentIngestionService;
  let worker: CommentIngestionWorker;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    ingest = vi.fn<(event: WebhookEvent, socialAccountId: string, logCtx: JobLogContext) => Promise<void>>().mockResolvedValue(undefined);
    ingestionService = { ingest } as unknown as CommentIngestionService;
    worker = new CommentIngestionWorker(ingestionService, tenantContext);
  });

  it('calls ingestionService.ingest with event, socialAccountId, and JobLogContext', async () => {
    await worker.process(makeJob());

    expect(ingest).toHaveBeenCalledWith(
      SAMPLE_EVENT,
      SOCIAL_ACCOUNT_ID,
      expect.objectContaining({
        jobId: 'job-001',
        attempt: 1,
        tenantId: TENANT_ID,
        platform: 'FACEBOOK',
        externalId: 'comment_123',
        correlationId: CORRELATION_ID,
      }),
    );
  });

  it('includes correlationId from job payload in logCtx', async () => {
    let capturedCtx: Parameters<typeof ingest>[2] | undefined;
    ingest.mockImplementation((_event, _accountId, ctx) => {
      capturedCtx = ctx;
      return Promise.resolve();
    });

    await worker.process(makeJob());

    expect(capturedCtx?.correlationId).toBe(CORRELATION_ID);
  });

  it('propagates undefined correlationId when job has none (backward compat)', async () => {
    let capturedCtx: Parameters<typeof ingest>[2] | undefined;
    ingest.mockImplementation((_event, _accountId, ctx) => {
      capturedCtx = ctx;
      return Promise.resolve();
    });

    await worker.process(makeJob(WEBHOOK_JOB_COMMENT, { correlationId: undefined }));

    expect(capturedCtx?.correlationId).toBeUndefined();
  });

  it('installs ALS tenant context before calling ingest', async () => {
    let capturedTenantId: string | undefined;
    ingest.mockImplementation(() => {
      capturedTenantId = tenantContext.getTenantId();
      return Promise.resolve();
    });

    await worker.process(makeJob());

    expect(capturedTenantId).toBe(TENANT_ID);
  });

  it('does not leak tenant context after processing', async () => {
    await worker.process(makeJob());
    expect(tenantContext.getTenantId()).toBeUndefined();
  });

  it('skips unknown job types without calling ingest', async () => {
    await worker.process(makeJob('unknown.job'));
    expect(ingest).not.toHaveBeenCalled();
  });

  it('propagates transient errors as-is so BullMQ can retry', async () => {
    const err = new Error('DB connection lost');
    ingest.mockRejectedValue(err);

    await expect(worker.process(makeJob())).rejects.toThrow('DB connection lost');
    await expect(worker.process(makeJob())).rejects.not.toThrow(UnrecoverableError);
  });

  it('wraps permanent Prisma P2003 errors in UnrecoverableError', async () => {
    const permanentErr = new Prisma.PrismaClientKnownRequestError('FK violation', {
      code: 'P2003',
      clientVersion: '5.x',
    });
    ingest.mockRejectedValue(permanentErr);

    await expect(worker.process(makeJob())).rejects.toThrow(UnrecoverableError);
  });

  it('wraps InfrastructureException(TENANT_CONTEXT_MISSING) in UnrecoverableError', async () => {
    ingest.mockRejectedValue(new InfrastructureException('TENANT_CONTEXT_MISSING', 'No context'));

    await expect(worker.process(makeJob())).rejects.toThrow(UnrecoverableError);
  });

  it('does NOT wrap expected meta_message_id P2002 in UnrecoverableError (idempotency path)', async () => {
    const idempotentErr = new Prisma.PrismaClientKnownRequestError('Unique violation', {
      code: 'P2002',
      clientVersion: '5.x',
      meta: { target: ['meta_message_id'] },
    });
    ingest.mockRejectedValue(idempotentErr);

    // Should rethrow the original error (not UnrecoverableError) so BullMQ can retry
    // and the service's claimEvent will skip on the next attempt
    await expect(worker.process(makeJob())).rejects.not.toThrow(UnrecoverableError);
    await expect(worker.process(makeJob())).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });
});
