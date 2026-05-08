import type { LeadListResponse, LeadStage } from './types';
import { apiFetch } from '../api-client';

export interface ListLeadsParams {
  search?: string;
  stage?: LeadStage;
  page?: number;
  limit?: number;
}

export async function listLeads(
  token: string | null,
  params: ListLeadsParams = {},
): Promise<LeadListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.stage) qs.set('stage', params.stage);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiFetch<LeadListResponse>(`/leads${query ? `?${query}` : ''}`, { token });
}
