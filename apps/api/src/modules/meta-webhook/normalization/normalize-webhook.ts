import { Logger } from '@nestjs/common';
import type { WebhookEvent } from '../dto/webhook-event.dto';
import {
  fbCommentValueSchema,
  igCommentValueSchema,
  type MetaWebhookRaw,
} from '../dto/meta-webhook-raw.dto';

const logger = new Logger('normalize-webhook');

export function normalizeWebhook(payload: MetaWebhookRaw): WebhookEvent[] {
  const events: WebhookEvent[] = [];

  for (const entry of payload.entry) {
    if (!entry.changes) continue;

    for (const change of entry.changes) {
      const event =
        payload.object === 'page'
          ? parseFacebookChange(entry.id, change.field, change.value)
          : parseInstagramChange(entry.id, change.field, change.value);

      if (event) events.push(event);
    }
  }

  return events;
}

function parseFacebookChange(
  pageId: string,
  field: string,
  value: Record<string, unknown>,
): WebhookEvent | null {
  if (field !== 'feed') return null;

  const parsed = fbCommentValueSchema.safeParse(value);
  if (!parsed.success) {
    if ((value as { item?: unknown }).item === 'comment') {
      logger.warn({ field, value }, 'FB comment change failed validation — discarding');
    } else {
      logger.debug({ field, item: (value as { item?: unknown }).item }, 'FB feed non-comment change — skipping');
    }
    return null;
  }

  const v = parsed.data;
  return {
    type: 'COMMENT',
    platform: 'FACEBOOK',
    externalId: v.comment_id,
    pageId,
    postId: v.post_id,
    parentCommentId: v.parent_id !== v.post_id ? (v.parent_id ?? null) : null,
    text: v.message,
    from: { externalUserId: v.from.id, name: v.from.name ?? null },
    timestamp: new Date(v.created_time * 1000),
    raw: value,
  };
}

function parseInstagramChange(
  pageId: string,
  field: string,
  value: Record<string, unknown>,
): WebhookEvent | null {
  if (field !== 'comments') {
    logger.debug({ field }, 'IG non-comment change — skipping');
    return null;
  }

  const parsed = igCommentValueSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn({ field, value }, 'IG comment change failed validation — discarding');
    return null;
  }

  const v = parsed.data;
  return {
    type: 'COMMENT',
    platform: 'INSTAGRAM',
    externalId: v.id,
    pageId,
    postId: v.media.id,
    parentCommentId: null,
    text: v.text,
    from: { externalUserId: v.from.id, name: v.from.username ?? null },
    timestamp: new Date(v.timestamp),
    raw: value,
  };
}
