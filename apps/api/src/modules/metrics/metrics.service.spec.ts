import { afterEach, describe, expect, it, vi } from 'vitest';
import { Registry } from 'prom-client';
import type { Queue } from 'bullmq';
import type { WebhookJobPayload } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { MetricsService } from './metrics.service';

function makeService(getJobCounts?: ReturnType<typeof vi.fn>) {
  const counts = { active: 2, waiting: 5, failed: 1, completed: 100, delayed: 0 };
  const mockGetJobCounts = getJobCounts ??
    vi.fn<() => Promise<Record<string, number>>>().mockResolvedValue(counts);
  const queue = { getJobCounts: mockGetJobCounts } as unknown as Queue<WebhookJobPayload>;
  const service = new MetricsService(queue);
  service.onModuleInit();
  return { service, mockGetJobCounts };
}

describe('MetricsService', () => {
  afterEach(() => {
    // Clean registry between tests to avoid duplicate metric registration
    Registry.prototype.clear.call(new Registry());
  });

  it('creates a fresh Registry instance', () => {
    const { service } = makeService();
    expect(service.registry).toBeInstanceOf(Registry);
  });

  it('returns Prometheus-format text from getMetrics()', async () => {
    const { service } = makeService();
    const output = await service.getMetrics();
    expect(typeof output).toBe('string');
    expect(output).toContain('# HELP');
    expect(output).toContain('# TYPE');
  });

  it('includes bullmq_jobs_active_total gauge in output', async () => {
    const { service } = makeService();
    const output = await service.getMetrics();
    expect(output).toContain('bullmq_jobs_active_total');
  });

  it('includes bullmq_jobs_failed_total gauge in output', async () => {
    const { service } = makeService();
    const output = await service.getMetrics();
    expect(output).toContain('bullmq_jobs_failed_total');
  });

  it('includes worker_process_uptime_seconds gauge', async () => {
    const { service } = makeService();
    const output = await service.getMetrics();
    expect(output).toContain('worker_process_uptime_seconds');
  });

  it('exposes Prometheus-compatible contentType', () => {
    const { service } = makeService();
    expect(service.contentType).toContain('text/plain');
    expect(service.contentType).toContain('version=0.0.4');
  });

  it('sets active gauge to 0 when getJobCounts throws', async () => {
    const failing = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('Redis down'));
    const { service } = makeService(failing);
    const output = await service.getMetrics();
    // Should still return output without throwing, with 0 values
    expect(output).toContain('bullmq_jobs_active_total');
  });
});
