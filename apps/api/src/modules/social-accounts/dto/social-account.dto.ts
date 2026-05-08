import { z } from 'zod';

export const socialAccountDtoSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM']),
  externalId: z.string(),
  displayName: z.string(),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'ERROR']),
  webhookSubscribedAt: z.date().nullable(),
  webhookSubscriptionError: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SocialAccountDto = z.infer<typeof socialAccountDtoSchema>;
