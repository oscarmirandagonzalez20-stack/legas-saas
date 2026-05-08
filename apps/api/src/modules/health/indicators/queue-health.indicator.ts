import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { WebhookJobPayload } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobPayload>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.queue.getJobCounts('active', 'waiting', 'failed');
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Queue health check failed',
        this.getStatus(key, false, { error: String(error) }),
      );
    }
  }
}
