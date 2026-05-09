import type { FailedJob, QueueStats } from './types';
import { apiFetch } from '../api-client';

export async function getQueueStats(token: string | null): Promise<QueueStats> {
  return apiFetch<QueueStats>('/queue/stats', { token });
}

export async function getFailedJobs(token: string | null, limit = 50): Promise<FailedJob[]> {
  return apiFetch<FailedJob[]>(`/queue/failed?limit=${String(limit)}`, { token });
}

export async function retryJob(
  jobId: string,
  token: string | null,
): Promise<{ retried: boolean }> {
  return apiFetch<{ retried: boolean }>(`/queue/failed/${jobId}/retry`, {
    method: 'POST',
    token,
  });
}
