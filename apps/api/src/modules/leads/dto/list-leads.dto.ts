import { z } from 'zod';

export const listLeadsSchema = z.object({
  search: z.string().trim().optional(),
  stage: z
    .enum(['NEW', 'CONTACTED', 'WHATSAPP_INITIATED', 'CONSULTATION_SCHEDULED', 'CONSULTATION_PAID', 'CLIENT', 'LOST'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListLeadsDto = z.infer<typeof listLeadsSchema>;

export interface LeadListResponse {
  data: LeadRow[];
  total: number;
  page: number;
  pages: number;
}

export interface LeadRow {
  id: string;
  externalUserId: string;
  displayName: string | null;
  areaLegal: string | null;
  stage: string;
  stageChangedAt: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
