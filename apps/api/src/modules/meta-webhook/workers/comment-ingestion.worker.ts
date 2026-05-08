import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import * as Sentry from '@sentry/node';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import type { JobLogContext } from '../dto/job-log-context.dto';
import { WEBHOOK_JOB_COMMENT, WEBHOOK_QUEUE, type WebhookJobPayload } from '../dto/webhook-job.dto';
import { isPermanentError } from '../error-classification';
import { CommentIngestionService } from './comment-ingestion.service';

export type { JobLogContext };

@Processor(WEBHOOK_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
  lockRenewTime: 15_000,
  maxStalledCount: 2,
})
export class CommentIngestionWorker extends WorkerHost {
  private readonly logger = new Logger(CommentIngestionWorker.name);

  constructor(
    private readonly ingestionService: CommentIngestionService,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobPayload>): Promise<void> {
    if (job.name !== WEBHOOK_JOB_COMMENT) {
      this.logger.warn({ jobName: job.name }, 'Unknown job type — skipping');
      return;
    }

    const { tenantId, socialAccountId, event, correlationId } = job.data;
    const logCtx: JobLogContext = {
      jobId: job.id ?? 'unknown',
      attempt: job.attemptsMade + 1,
      tenantId,
      platform: event.platform,
      externalId: event.externalId,
      correlationId,
    };

    this.logger.debug(logCtx, 'Job started');
    const startedAt = Date.now();

    try {
      await this.tenantContext.run({ tenantId }, () =>
        this.ingestionService.ingest(event, socialAccountId, logCtx),
      );

      this.logger.debug({ ...logCtx, durationMs: Date.now() - startedAt }, 'Job completed');
    } catch (err) {
      const durationMs = Date.now() - startedAt;

      if (isPermanentError(err)) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ ...logCtx, durationMs, error: message }, 'Job failed permanently — moving to DLQ');
        // Capture permanent job failures in Sentry — these won't be retried
        Sentry.withScope((scope) => {
          scope.setTag('tenantId', tenantId);
          scope.setTag('correlationId', correlationId);
          scope.setTag('jobId', logCtx.jobId);
          scope.setTag('platform', event.platform);
          Sentry.captureException(err instanceof Error ? err : new Error(message));
        });
        throw new UnrecoverableError(message);
      }

      this.logger.warn(
        { ...logCtx, durationMs, error: err instanceof Error ? err.message : String(err) },
        'Job failed transiently — will retry',
      );
      throw err;
    }
  }
}
