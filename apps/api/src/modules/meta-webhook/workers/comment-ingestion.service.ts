import { Injectable, Logger } from '@nestjs/common';
import { InfrastructureException } from '@/common/exceptions/app.exception';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import type { WebhookEvent } from '../dto/webhook-event.dto';
import type { JobLogContext } from '../dto/job-log-context.dto';

// How long a PROCESSING row is considered active before being treated as a zombie.
export const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1_000;

export type ClaimResult = 'claimed' | 'skip';

@Injectable()
export class CommentIngestionService {
  private readonly logger = new Logger(CommentIngestionService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async ingest(event: WebhookEvent, socialAccountId: string, logCtx: JobLogContext): Promise<void> {
    const ctx = this.tenantContext.getContext();
    if (!ctx) {
      throw new InfrastructureException('TENANT_CONTEXT_MISSING', 'No tenant context in ingest');
    }
    const { tenantId } = ctx;

    const idempotencyKey = `${event.platform}:${event.externalId}`;
    const claimed = await this.claimEvent(idempotencyKey, event);

    if (claimed === 'skip') {
      this.logger.debug({ ...logCtx, idempotencyKey }, 'Event already claimed — skipping');
      return;
    }

    try {
      await this.processEvent(event, socialAccountId, tenantId);

      await this.prisma.inboundEvent.update({
        where: { source_externalId: { source: 'meta-webhook', externalId: idempotencyKey } },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });

      this.logger.debug({ ...logCtx, idempotencyKey, tenantId }, 'Event processed successfully');
    } catch (err) {
      // Mark the event as FAILED on permanent errors so it doesn't get reclaimed
      // as a zombie. Transient errors leave the row in PROCESSING — the stale
      // threshold will reclaim it on the next retry attempt.
      await this.prisma.inboundEvent.update({
        where: { source_externalId: { source: 'meta-webhook', externalId: idempotencyKey } },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  /**
   * Atomically transitions an InboundEvent from RECEIVED → PROCESSING (or reclaims
   * a zombie PROCESSING row older than STALE_PROCESSING_THRESHOLD_MS).
   *
   * The two-phase approach (UPSERT then UPDATE) is safe under concurrency:
   * - UPSERT creates the row with RECEIVED if it doesn't exist (conflict → no-op)
   * - UPDATE atomically claims it; only one concurrent worker wins the row lock
   */
  async claimEvent(idempotencyKey: string, event: WebhookEvent): Promise<ClaimResult> {
    // Phase 1: ensure the row exists with status=RECEIVED (idempotent insert)
    await this.prisma.$executeRaw`
      INSERT INTO inbound_events (id, source, external_id, payload, status, received_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'meta-webhook',
        ${idempotencyKey},
        ${event as unknown}::jsonb,
        'RECEIVED'::"InboundEventStatus",
        NOW(),
        NOW()
      )
      ON CONFLICT (source, external_id) DO NOTHING
    `;

    // Phase 2: atomic claim — transitions RECEIVED → PROCESSING, or reclaims zombie
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE inbound_events
      SET
        status = 'PROCESSING'::"InboundEventStatus",
        processing_started_at = NOW(),
        updated_at = NOW()
      WHERE source = 'meta-webhook'
        AND external_id = ${idempotencyKey}
        AND (
          status = 'RECEIVED'::"InboundEventStatus"
          OR (
            status = 'PROCESSING'::"InboundEventStatus"
            AND processing_started_at < ${staleCutoff}
          )
        )
      RETURNING id
    `;

    return result.length > 0 ? 'claimed' : 'skip';
  }

  private async processEvent(
    event: WebhookEvent,
    socialAccountId: string,
    tenantId: string,
  ): Promise<void> {
    await this.tenantPrisma.run(async (tx) => {
      const lead =
        (await tx.lead.findFirst({
          where: { externalUserId: event.from.externalUserId },
          select: { id: true },
        })) ??
        (await tx.lead.create({
          data: {
            tenantId,
            externalUserId: event.from.externalUserId,
            displayName: event.from.name,
            tags: [],
          },
          select: { id: true },
        }));

      const conversation =
        (await tx.conversation.findFirst({
          where: { leadId: lead.id, socialAccountId },
          select: { id: true },
        })) ??
        (await tx.conversation.create({
          data: {
            tenantId,
            leadId: lead.id,
            socialAccountId,
            externalThreadId: event.postId,
          },
          select: { id: true },
        }));

      const messageExists = await tx.message.findUnique({
        where: { metaMessageId: event.externalId },
        select: { id: true },
      });
      if (!messageExists) {
        await tx.message.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            direction: 'INBOUND',
            sender: 'USER',
            body: event.text,
            metaMessageId: event.externalId,
          },
        });
      }
    });
  }
}
