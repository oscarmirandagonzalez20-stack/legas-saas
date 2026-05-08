import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';
import type { WebhookJobPayload } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();

  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobPayload>,
  ) {}

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
    this.registerBullMQGauges();
    this.registerProcessGauges();
    this.logger.log('Prometheus metrics registered');
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  private registerBullMQGauges(): void {
    const queue = this.queue;

    const jobStates = ['active', 'waiting', 'failed', 'completed', 'delayed'] as const;

    for (const state of jobStates) {
      new Gauge({
        name: `bullmq_jobs_${state}_total`,
        help: `Number of ${state} jobs in queue ${WEBHOOK_QUEUE}`,
        labelNames: ['queue'],
        registers: [this.registry],
        async collect() {
          try {
            const counts = await queue.getJobCounts(state);
            this.set({ queue: WEBHOOK_QUEUE }, counts[state] ?? 0);
          } catch {
            this.set({ queue: WEBHOOK_QUEUE }, 0);
          }
        },
      });
    }
  }

  private registerProcessGauges(): void {
    new Gauge({
      name: 'worker_process_uptime_seconds',
      help: 'Node.js process uptime in seconds',
      registers: [this.registry],
      collect() {
        this.set(process.uptime());
      },
    });
  }
}
