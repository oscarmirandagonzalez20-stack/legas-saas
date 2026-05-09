export interface SystemStatus {
  queueHealthy: boolean;
  webhookConnected: boolean;
  accountsWithError: number;
  retryPending: number;
}

export async function fetchSystemStatus(token: string | null): Promise<SystemStatus> {
  const { apiFetch } = await import('@/lib/api-client');
  try {
    const health = await apiFetch<{ status: string; info?: Record<string, { status: string }> }>(
      '/health/ready',
      { token },
    );
    return {
      queueHealthy: health.info?.queue?.status === 'up',
      webhookConnected: true,
      accountsWithError: 0,
      retryPending: 0,
    };
  } catch {
    return { queueHealthy: false, webhookConnected: false, accountsWithError: 0, retryPending: 0 };
  }
}
