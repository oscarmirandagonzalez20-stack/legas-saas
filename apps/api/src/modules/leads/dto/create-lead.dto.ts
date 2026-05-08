import { z } from 'zod';

export const createLeadSchema = z.object({
  externalUserId: z.string().min(1),
  displayName: z.string().optional(),
  areaLegal: z.string().optional(),
  whatsappPhone: z.string().optional(),
  email: z.string().email().optional(),
});

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
