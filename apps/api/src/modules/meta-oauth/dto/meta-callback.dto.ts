import { z } from 'zod';

// Meta OAuth callback query parameters.
// Meta sends either:
//   - success: { code, state }
//   - error:   { error, error_description?, state? }
export const metaCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type MetaCallbackDto = z.infer<typeof metaCallbackSchema>;

// Internal OAuth state stored in Redis (single-use, TTL 10 min)
export const oauthStateSchema = z.object({
  nonce: z.string().uuid(),
  tenantId: z.string().uuid(),
  issuedAt: z.number().int().positive(),
  returnUrl: z.string().url().optional(),
});

export type OAuthState = z.infer<typeof oauthStateSchema>;

export const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes
export const OAUTH_STATE_KEY_PREFIX = 'oauth:state:' as const;
