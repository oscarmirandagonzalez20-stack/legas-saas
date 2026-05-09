import { ApiError } from './api/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DEV_ORG_ID =
  process.env.NEXT_PUBLIC_DEV_ORG_ID ?? 'dev-org-00000000-0000-0000-0000-000000000001';
const IS_DEV_BYPASS = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// ── Server-side fetch (Server Components / Route Handlers) ───────────────────

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (IS_DEV_BYPASS) {
    headers['X-Dev-Tenant-Id'] = DEV_ORG_ID;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
      errorCode?: string;
    };
    throw new ApiError(res.status, body.message ?? res.statusText, body.errorCode);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Client-side fetch factory (for use with TanStack Query) ──────────────────

export function makeClientFetcher(getToken: () => Promise<string | null>) {
  return async function clientFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await getToken();
    return apiFetch<T>(path, { ...options, token });
  };
}
