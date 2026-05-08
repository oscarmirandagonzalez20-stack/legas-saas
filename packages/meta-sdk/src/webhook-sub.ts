import { MetaApiError } from './errors';
import { metaErrorResponseSchema, metaSubscriptionResponseSchema } from './types';

export const WEBHOOK_SUBSCRIBE_FIELDS = ['feed', 'comments'] as const;

async function throwIfMetaError(res: Response): Promise<void> {
  if (res.ok) return;
  const json = await res.json().catch(() => null) as unknown;
  const errParsed = metaErrorResponseSchema.safeParse(json);
  if (errParsed.success) {
    const { message, code, error_subcode, fbtrace_id } = errParsed.data.error;
    throw new MetaApiError(message, code, error_subcode, fbtrace_id);
  }
  throw new MetaApiError(`Meta API error: HTTP ${String(res.status)}`, 0);
}

export async function subscribeWebhook(
  graphBaseUrl: string,
  pageId: string,
  pageToken: string,
  fields: readonly string[] = WEBHOOK_SUBSCRIBE_FIELDS,
): Promise<void> {
  const body = new URLSearchParams({
    access_token: pageToken,
    subscribed_fields: fields.join(','),
  });
  const res = await fetch(`${graphBaseUrl}/${pageId}/subscribed_apps`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  await throwIfMetaError(res);
  const json = await res.json() as unknown;
  const parsed = metaSubscriptionResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.success) {
    throw new MetaApiError('Webhook subscription returned success=false', 0);
  }
}

export async function unsubscribeWebhook(
  graphBaseUrl: string,
  pageId: string,
  pageToken: string,
): Promise<void> {
  const params = new URLSearchParams({ access_token: pageToken });
  const res = await fetch(`${graphBaseUrl}/${pageId}/subscribed_apps?${params.toString()}`, {
    method: 'DELETE',
  });
  await throwIfMetaError(res);
}
