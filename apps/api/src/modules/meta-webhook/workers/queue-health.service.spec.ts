import type { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueHealthService } from './queue-health.service';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  const service = new QueueHealthService();
  const logger = (service as unknown as { logger: Logger }).logger;
  const fatal = vi.spyOn(logger, 'fatal').mockImplementation(() => undefined);
  const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  return { service, fatal, error };
}

function fireFailed(service: QueueHealthService, jobId = 'job-1', failedReason = 'boom'): void {
  service.onFailed({ jobId, failedReason });
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('QueueHealthService', () => {
  let service: QueueHealthService;
  let fatal: ReturnType<typeof makeService>['fatal'];
  let error: ReturnType<typeof makeService>['error'];

  beforeEach(() => {
    ({ service, fatal, error } = makeService());
  });

  it('logs error on every failed event', () => {
    fireFailed(service);
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', failedReason: 'boom' }),
      expect.any(String),
    );
  });

  it('does not fire fatal alert below threshold', () => {
    for (let i = 0; i < 9; i++) fireFailed(service, `job-${String(i)}`);
    expect(fatal).not.toHaveBeenCalled();
  });

  it('fires fatal alert at exactly the threshold (10 failures)', () => {
    for (let i = 0; i < 10; i++) fireFailed(service, `job-${String(i)}`);
    expect(fatal).toHaveBeenCalledOnce();
    expect(fatal).toHaveBeenCalledWith(
      expect.objectContaining({ failureCount: 10 }),
      expect.any(String),
    );
  });

  it('fires fatal alert on each subsequent failure after threshold', () => {
    for (let i = 0; i < 12; i++) fireFailed(service, `job-${String(i)}`);
    expect(fatal).toHaveBeenCalledTimes(3); // at 10, 11, and 12
  });

  it('resets window after failures expire outside the 5-minute window', () => {
    vi.useFakeTimers();

    // Fire 10 failures to trigger alert
    for (let i = 0; i < 10; i++) fireFailed(service, `job-${String(i)}`);
    expect(fatal).toHaveBeenCalledOnce();

    // Advance time past the 5-minute window
    vi.advanceTimersByTime(5 * 60 * 1_000 + 1);

    // New failure — window is clean, should not trigger alert
    fatal.mockClear();
    fireFailed(service, 'job-new');
    expect(fatal).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not mutate the timestamp array in-place (immutable sliding window)', () => {
    fireFailed(service);
    const firstSnapshot = (service as unknown as { recentFailureTimestamps: readonly number[] }).recentFailureTimestamps;

    fireFailed(service);
    const secondSnapshot = (service as unknown as { recentFailureTimestamps: readonly number[] }).recentFailureTimestamps;

    // Each event should produce a new array reference
    expect(firstSnapshot).not.toBe(secondSnapshot);
    expect(secondSnapshot.length).toBe(2);
  });
});
