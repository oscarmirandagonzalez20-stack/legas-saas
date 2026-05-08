import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Env } from '@/config/env.validation';
import { PrismaService } from '@/prisma/prisma.service';
import type { MetaWebhookRaw } from './dto/meta-webhook-raw.dto';
import { WEBHOOK_JOB_COMMENT, WEBHOOK_QUEUE, type WebhookJobPayload } from './dto/webhook-job.dto';
import { normalizeWebhook } from './normalization/normalize-webhook';

const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { count: 1_000, age: 24 * 3600 },
  removeOnFail: false,
} as const;

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue<WebhookJobPayload>,
  ) {}

  verifyWebhook(query: Record<string, string>): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode !== 'subscribe') throw new UnauthorizedException('Invalid hub.mode');
    if (token !== this.config.get('META_VERIFY_TOKEN', { infer: true })) {
      throw new UnauthorizedException('hub.verify_token mismatch');
    }
    if (!challenge) throw new UnauthorizedException('Missing hub.challenge');

    return challenge;
  }

  async handleWebhook(payload: MetaWebhookRaw, correlationId: string): Promise<void> {
    const events = normalizeWebhook(payload);

    if (events.length === 0) {
      this.logger.debug('Webhook contained no processable events');
      return;
    }

    for (const event of events) {
      // Resolve tenantId from pageId via social_accounts (no RLS — uses PrismaService directly)
      const account = await this.prisma.socialAccount.findFirst({
        where: { externalId: event.pageId, status: 'ACTIVE' },
        select: { id: true, tenantId: true },
      });

      if (!account) {
        this.logger.warn(
          { pageId: event.pageId, platform: event.platform },
          'No active social account found for pageId — discarding event',
        );
        continue;
      }

      const jobId = `${event.platform}:${event.externalId}`;
      const jobPayload: WebhookJobPayload = {
        tenantId: account.tenantId,
        socialAccountId: account.id,
        event,
        receivedAt: new Date().toISOString(),
        correlationId,
      };

      await this.queue.add(WEBHOOK_JOB_COMMENT, jobPayload, { ...JOB_OPTIONS, jobId });
      this.logger.debug({ jobId, tenantId: account.tenantId }, 'Webhook job enqueued');
    }
  }
}
