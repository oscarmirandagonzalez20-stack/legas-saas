import { z } from 'zod';

export const webhookEventSchema = z.object({
  type: z.enum(['COMMENT', 'MESSAGE']),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM']),
  externalId: z.string().min(1),
  pageId: z.string().min(1),
  postId: z.string().nullable(),
  parentCommentId: z.string().nullable(),
  text: z.string(),
  from: z.object({
    externalUserId: z.string().min(1),
    name: z.string().nullable(),
  }),
  timestamp: z.coerce.date(),
  raw: z.record(z.unknown()),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
