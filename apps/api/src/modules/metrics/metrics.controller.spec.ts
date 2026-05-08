import { describe, expect, it, vi } from 'vitest';
import { MetricsController } from './metrics.controller';
import type { MetricsService } from './metrics.service';

function makeController(metricsOutput = 'metrics_output 1') {
  const getMetrics = vi.fn<() => Promise<string>>().mockResolvedValue(metricsOutput);
  const service = { getMetrics } as unknown as MetricsService;
  return { controller: new MetricsController(service), getMetrics };
}

describe('MetricsController', () => {
  it('returns the output of MetricsService.getMetrics()', async () => {
    const expected = '# HELP foo bar\nfoo 42\n';
    const { controller } = makeController(expected);

    const result = await controller.getMetrics();

    expect(result).toBe(expected);
  });

  it('delegates to MetricsService exactly once', async () => {
    const { controller, getMetrics } = makeController();

    await controller.getMetrics();

    expect(getMetrics).toHaveBeenCalledOnce();
  });
});
