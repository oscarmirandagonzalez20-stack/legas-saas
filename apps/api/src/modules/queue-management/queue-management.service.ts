import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue, Job } from 'bullmq';
import type { WebhookJobPayload } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';

export interface QueueStats {
  queueName: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

export interface FailedJobRow {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  finishedOn: number | null;
  correlationId: string | null;
  eventType: string | null;
}

@Injectable()
export class QueueManagementService {
  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobPayload>,
  ) {}

  async getStats(): Promise<QueueStats> {
    const [counts, isPaused] = await Promise.all([
      this.queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed'),
      this.queue.isPaused(),
    ]);

    return {
      queueName: WEBHOOK_QUEUE,
      active: counts.active ?? 0,
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      paused: isPaused,
    };
  }

  async getFailedJobs(limit = 50): Promise<FailedJobRow[]> {
    const jobs = await this.queue.getFailed(0, limit - 1);
    return jobs.map((job: Job<WebhookJobPayload>) => ({
      id: String(job.id),
      name: job.name,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn ?? null,
      correlationId: job.data.correlationId ?? null,
      eventType: job.data.event.type,
    }));
  }

  async retryJob(jobId: string): Promise<{ retried: boolean }> {
    const job = await this.queue.getJob(jobId);
    if (!job) return { retried: false };

    // Only retry webhook worker jobs — no arbitrary execution
    const isFailed = await job.isFailed();
    if (!isFailed) return { retried: false };

    await job.retry('failed');
    return { retried: true };
  }
}
