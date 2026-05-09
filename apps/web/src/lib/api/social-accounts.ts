import type { SocialAccount } from './types';
import { apiFetch } from '../api-client';

export async function listSocialAccounts(token: string | null): Promise<SocialAccount[]> {
  return apiFetch<SocialAccount[]>('/social-accounts', { token });
}

export async function disconnectSocialAccount(
  id: string,
  token: string | null,
): Promise<undefined> {
  return apiFetch<undefined>(`/social-accounts/${id}`, { method: 'DELETE', token });
}

export async function getConnectMetaUrl(
  token: string | null,
  returnUrl?: string,
): Promise<{ url: string }> {
  const qs = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
  return apiFetch<{ url: string }>(`/social-accounts/meta/connect${qs}`, { token });
}

export async function getReconnectUrl(
  id: string,
  token: string | null,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/social-accounts/${id}/reconnect`, {
    method: 'POST',
    token,
  });
}
