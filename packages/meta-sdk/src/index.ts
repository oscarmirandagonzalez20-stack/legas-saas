export const META_GRAPH_VERSION = 'v21.0' as const;
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}` as const;

export type MetaPlatform = 'FACEBOOK' | 'INSTAGRAM';

export type { MetaPage, MetaIgAccount, MetaLongLivedToken, MetaErrorResponse } from './types';
export { metaPageSchema, metaIgAccountSchema, metaPagesResponseSchema } from './types';

export { MetaApiError, META_ERROR_CODES, isMetaTokenError, isMetaRateLimitError } from './errors';

export {
  META_OAUTH_SCOPES,
  buildAuthUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  getInstagramAccount,
} from './oauth';

export {
  WEBHOOK_SUBSCRIBE_FIELDS,
  subscribeWebhook,
  unsubscribeWebhook,
} from './webhook-sub';
