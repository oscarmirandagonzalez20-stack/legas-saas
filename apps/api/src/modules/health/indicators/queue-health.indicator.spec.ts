import { describe, expect, it, vi } from 'vitest';
import { HealthCheckError } from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import type { WebhookJobPayload } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { QueueHealthIndicator } from './queue-health.indicator';

function makeIndicator(getJobCounts: ReturnType<typeof vi.fn>) {
  const queue = { getJobCounts } as unknown as Queue<WebhookJobPayload>;
  return new QueueHealthIndicator(queue);
}

describe('QueueHealthIndicator', () => {
  it('returns healthy status when queue responds', async () => {
    const indicator = makeIndicator(
      vi.fn<() => Promise<Record<string, number>>>().mockResolvedValue({ active: 0, waiting: 0, failed: 0 }),
    );

    const result = await indicator.isHealthy('queue');

    expect(result).toMatchObject({ queue: { status: 'up' } });
  });

  it('throws HealthCheckError when queue is unreachable', async () => {
    const indicator = makeIndicator(
      vi.fn<() => Promise<never>>().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    await expect(indicator.isHealthy('queue')).rejects.toThrow(HealthCheckError);
  });

  it('HealthCheckError contains the error detail', async () => {
    const indicator = makeIndicator(
      vi.fn<() => Promise<never>>().mockRejectedValue(new Error('Redis timeout')),
    );

    await expect(indicator.isHealthy('queue')).rejects.toMatchObject({
      causes: expect.objectContaining({ queue: expect.objectContaining({ status: 'down' }) }),
    });
  });
});
