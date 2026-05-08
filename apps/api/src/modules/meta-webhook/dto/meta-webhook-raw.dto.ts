import { z } from 'zod';

// Facebook comment change value
const fbCommentValueSchema = z.object({
  item: z.literal('comment'),
  comment_id: z.string(),
  post_id: z.string(),
  parent_id: z.string().optional(),
  from: z.object({ id: z.string(), name: z.string().optional() }),
  message: z.string(),
  created_time: z.number(),
});

// Facebook generic feed change (we only process item=comment)
const fbFeedValueSchema = z.object({ item: z.string() }).passthrough();

// Instagram comment change value
const igCommentValueSchema = z.object({
  id: z.string(),
  text: z.string(),
  from: z.object({ id: z.string(), username: z.string().optional() }),
  media: z.object({ id: z.string() }),
  timestamp: z.string(),
});

const changeSchema = z
  .object({ field: z.string(), value: z.record(z.unknown()) })
  .passthrough();

const entrySchema = z.object({
  id: z.string(),
  time: z.number().optional(),
  changes: z.array(changeSchema).optional(),
});

export const metaWebhookRawSchema = z.object({
  object: z.enum(['page', 'instagram']),
  entry: z.array(entrySchema),
});

export type MetaWebhookRaw = z.infer<typeof metaWebhookRawSchema>;
export type FbCommentValue = z.infer<typeof fbCommentValueSchema>;
export type IgCommentValue = z.infer<typeof igCommentValueSchema>;
export type FbFeedValue = z.infer<typeof fbFeedValueSchema>;

export { fbCommentValueSchema, igCommentValueSchema, fbFeedValueSchema };
