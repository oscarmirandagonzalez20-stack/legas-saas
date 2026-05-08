import { z } from 'zod';

// ── Token responses ───────────────────────────────────────────────────────────

export const metaTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
});

export const metaLongLivedTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

export type MetaLongLivedToken = z.infer<typeof metaLongLivedTokenResponseSchema>;

// ── Pages ─────────────────────────────────────────────────────────────────────

export const metaPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string(),
  tasks: z.array(z.string()).optional(),
  instagram_business_account: z.object({ id: z.string() }).optional(),
});

export type MetaPage = z.infer<typeof metaPageSchema>;

export const metaPagesResponseSchema = z.object({
  data: z.array(metaPageSchema),
});

// ── Instagram ─────────────────────────────────────────────────────────────────

export const metaIgAccountSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
  name: z.string().optional(),
});

export type MetaIgAccount = z.infer<typeof metaIgAccountSchema>;

// ── Errors ────────────────────────────────────────────────────────────────────

export const metaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

export type MetaErrorResponse = z.infer<typeof metaErrorResponseSchema>;

// ── Webhook subscription ──────────────────────────────────────────────────────

export const metaSubscriptionResponseSchema = z.object({
  success: z.boolean(),
});
