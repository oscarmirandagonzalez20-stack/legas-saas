import type { Metadata } from 'next';
import { getServerAuth } from '@/auth/server';
import { getQueueStats, getFailedJobs } from '@/lib/api/queue';
import { QueueStatsCard } from '@/components/queue/queue-stats-card';
import { FailedJobsTable } from '@/components/queue/failed-jobs-table';

export const metadata: Metadata = { title: 'Cola de procesamiento — Legal SaaS' };

export default async function QueuePage() {
  const auth = await getServerAuth();
  const token = await auth.getToken();

  const [statsResult, failedResult] = await Promise.allSettled([
    getQueueStats(token),
    getFailedJobs(token, 50),
  ]);

  const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
  const failedJobs = failedResult.status === 'fulfilled' ? failedResult.value : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Cola de procesamiento</h1>
        <p className="text-sm text-muted-foreground">
          Estado del queue de webhooks y jobs fallidos.
        </p>
      </div>

      <QueueStatsCard stats={stats} />

      <div>
        <h2 className="text-sm font-semibold mb-3">Jobs fallidos</h2>
        <FailedJobsTable jobs={failedJobs} />
      </div>
    </div>
  );
}
