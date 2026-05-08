import { MetaApiError } from './errors';
import {
  metaErrorResponseSchema,
  metaIgAccountSchema,
  metaLongLivedTokenResponseSchema,
  metaPagesResponseSchema,
  metaTokenResponseSchema,
  type MetaIgAccount,
  type MetaLongLivedToken,
  type MetaPage,
} from './types';

// Scopes required for comment ingestion + private replies
export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'instagram_basic',
  'instagram_manage_comments',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthUrl(
  appId: string,
  redirectUri: string,
  state: string,
  scopes: readonly string[] = META_OAUTH_SCOPES,
): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  graphBaseUrl: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${graphBaseUrl}/oauth/access_token?${params.toString()}`);
  await throwIfMetaError(res);
  const json = await res.json() as unknown;
  return metaTokenResponseSchema.parse(json).access_token;
}

export async function getLongLivedToken(
  graphBaseUrl: string,
  appId: string,
  appSecret: string,
  shortLivedToken: string,
): Promise<MetaLongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${graphBaseUrl}/oauth/access_token?${params.toString()}`);
  await throwIfMetaError(res);
  const json = await res.json() as unknown;
  return metaLongLivedTokenResponseSchema.parse(json);
}

export async function getPages(graphBaseUrl: string, userToken: string): Promise<MetaPage[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token,tasks,instagram_business_account',
    access_token: userToken,
  });
  const res = await fetch(`${graphBaseUrl}/me/accounts?${params.toString()}`);
  await throwIfMetaError(res);
  const json = await res.json() as unknown;
  return metaPagesResponseSchema.parse(json).data;
}

export async function getInstagramAccount(
  graphBaseUrl: string,
  igAccountId: string,
  pageToken: string,
): Promise<MetaIgAccount> {
  const params = new URLSearchParams({
    fields: 'id,username,name',
    access_token: pageToken,
  });
  const res = await fetch(`${graphBaseUrl}/${igAccountId}?${params.toString()}`);
  await throwIfMetaError(res);
  const json = await res.json() as unknown;
  return metaIgAccountSchema.parse(json);
}
