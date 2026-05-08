import { Logger } from '@nestjs/common';
import { OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from '../dto/webhook-job.dto';

const ALERT_WINDOW_MS = 5 * 60 * 1_000;
const ALERT_THRESHOLD = 10;

@QueueEventsListener(WEBHOOK_QUEUE)
export class QueueHealthService extends QueueEventsHost {
  private readonly logger = new Logger(QueueHealthService.name);

  // Sliding window of failure timestamps — replaced wholesale on each event,
  // never mutated in-place. No persistent counter, no state that survives restart.
  private recentFailureTimestamps: readonly number[] = [];

  @OnQueueEvent('failed')
  onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }): void {
    this.logger.error({ jobId, failedReason }, 'Job moved to failed (DLQ)');

    const now = Date.now();
    const cutoff = now - ALERT_WINDOW_MS;

    this.recentFailureTimestamps = [
      ...this.recentFailureTimestamps.filter((ts) => ts >= cutoff),
      now,
    ];

    const failureCount = this.recentFailureTimestamps.length;
    if (failureCount >= ALERT_THRESHOLD) {
      this.logger.fatal(
        { failureCount, windowMs: ALERT_WINDOW_MS },
        'ALERT: Elevated DLQ failure rate — manual intervention required',
      );
    }
  }
}
