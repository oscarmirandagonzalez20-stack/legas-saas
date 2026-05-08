import { describe, expect, it } from 'vitest';
import { normalizeWebhook } from './normalize-webhook';
import type { MetaWebhookRaw } from '../dto/meta-webhook-raw.dto';

// ── fixtures ──────────────────────────────────────────────────────────────────

const FB_COMMENT_PAYLOAD: MetaWebhookRaw = {
  object: 'page',
  entry: [
    {
      id: 'page_123',
      time: 1700000000,
      changes: [
        {
          field: 'feed',
          value: {
            item: 'comment',
            comment_id: 'comment_abc',
            post_id: 'post_xyz',
            from: { id: 'user_001', name: 'María García' },
            message: 'Necesito asesoría familiar urgente',
            created_time: 1700000000,
          },
        },
      ],
    },
  ],
};

const IG_COMMENT_PAYLOAD: MetaWebhookRaw = {
  object: 'instagram',
  entry: [
    {
      id: 'ig_page_123',
      time: 1700000000,
      changes: [
        {
          field: 'comments',
          value: {
            id: 'ig_comment_abc',
            text: 'Hola, tengo una consulta fiscal',
            from: { id: 'ig_user_001', username: 'juanperez' },
            media: { id: 'media_xyz' },
            timestamp: '2023-11-14T22:13:20Z',
          },
        },
      ],
    },
  ],
};

// ── Facebook ──────────────────────────────────────────────────────────────────

describe('normalizeWebhook — Facebook', () => {
  it('extracts a COMMENT event from a page feed change', () => {
    const events = normalizeWebhook(FB_COMMENT_PAYLOAD);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'COMMENT',
      platform: 'FACEBOOK',
      externalId: 'comment_abc',
      pageId: 'page_123',
      postId: 'post_xyz',
      text: 'Necesito asesoría familiar urgente',
      from: { externalUserId: 'user_001', name: 'María García' },
    });
  });

  it('sets timestamp from created_time (unix seconds)', () => {
    const events = normalizeWebhook(FB_COMMENT_PAYLOAD);
    expect(events[0]?.timestamp).toEqual(new Date(1700000000 * 1000));
  });

  it('preserves raw payload', () => {
    const events = normalizeWebhook(FB_COMMENT_PAYLOAD);
    expect(events[0]?.raw).toMatchObject({ item: 'comment', comment_id: 'comment_abc' });
  });

  it('returns empty array for non-comment feed changes (like, reaction)', () => {
    const payload: MetaWebhookRaw = {
      object: 'page',
      entry: [
        {
          id: 'page_123',
          changes: [{ field: 'feed', value: { item: 'like', post_id: 'p1' } }],
        },
      ],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });

  it('returns empty array for non-feed field', () => {
    const payload: MetaWebhookRaw = {
      object: 'page',
      entry: [{ id: 'page_123', changes: [{ field: 'messages', value: {} }] }],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });

  it('discards malformed comment (missing required field) and returns empty', () => {
    const payload: MetaWebhookRaw = {
      object: 'page',
      entry: [
        {
          id: 'page_123',
          changes: [
            {
              field: 'feed',
              value: { item: 'comment' },   // missing comment_id, from, message
            },
          ],
        },
      ],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });

  it('processes multiple entries and changes', () => {
    const payload: MetaWebhookRaw = {
      object: 'page',
      entry: [
        {
          id: 'page_1',
          changes: [
            {
              field: 'feed',
              value: {
                item: 'comment',
                comment_id: 'c1',
                post_id: 'p1',
                from: { id: 'u1' },
                message: 'msg1',
                created_time: 1700000001,
              },
            },
            {
              field: 'feed',
              value: {
                item: 'comment',
                comment_id: 'c2',
                post_id: 'p1',
                from: { id: 'u2' },
                message: 'msg2',
                created_time: 1700000002,
              },
            },
          ],
        },
      ],
    };
    expect(normalizeWebhook(payload)).toHaveLength(2);
  });
});

// ── Instagram ─────────────────────────────────────────────────────────────────

describe('normalizeWebhook — Instagram', () => {
  it('extracts a COMMENT event from an instagram comments change', () => {
    const events = normalizeWebhook(IG_COMMENT_PAYLOAD);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'COMMENT',
      platform: 'INSTAGRAM',
      externalId: 'ig_comment_abc',
      pageId: 'ig_page_123',
      postId: 'media_xyz',
      text: 'Hola, tengo una consulta fiscal',
      from: { externalUserId: 'ig_user_001', name: 'juanperez' },
    });
  });

  it('parses ISO timestamp correctly', () => {
    const events = normalizeWebhook(IG_COMMENT_PAYLOAD);
    expect(events[0]?.timestamp).toEqual(new Date('2023-11-14T22:13:20Z'));
  });

  it('returns empty array for non-comments field', () => {
    const payload: MetaWebhookRaw = {
      object: 'instagram',
      entry: [{ id: 'ig_123', changes: [{ field: 'mentions', value: {} }] }],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });

  it('discards malformed IG comment and returns empty', () => {
    const payload: MetaWebhookRaw = {
      object: 'instagram',
      entry: [
        {
          id: 'ig_123',
          changes: [{ field: 'comments', value: { id: 'c1' } }],   // missing text, from, media
        },
      ],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('normalizeWebhook — edge cases', () => {
  it('returns empty array when entry has no changes', () => {
    const payload: MetaWebhookRaw = {
      object: 'page',
      entry: [{ id: 'page_123' }],
    };
    expect(normalizeWebhook(payload)).toHaveLength(0);
  });

  it('returns empty array for empty entry list', () => {
    expect(normalizeWebhook({ object: 'page', entry: [] })).toHaveLength(0);
  });
});
