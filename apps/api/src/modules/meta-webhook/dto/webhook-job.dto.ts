import { z } from 'zod';
import { webhookEventSchema } from './webhook-event.dto';

export const webhookJobSchema = z.object({
  tenantId: z.string().uuid(),
  socialAccountId: z.string().uuid(),
  event: webhookEventSchema,
  receivedAt: z.string().datetime(),
  // optional for backward compat with jobs already in queue at deploy time
  correlationId: z.string().uuid().optional(),
});

export type WebhookJobPayload = z.infer<typeof webhookJobSchema>;

export const WEBHOOK_QUEUE = 'webhook-processing' as const;
export const WEBHOOK_JOB_COMMENT = 'comment.received' as const;
