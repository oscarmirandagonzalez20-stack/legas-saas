'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { useAuthToken } from '@/auth/hooks';
import { retryJob } from '@/lib/api/queue';
import { ApiError } from '@/lib/api/types';
import type { FailedJob } from '@/lib/api/types';

interface Props {
  jobs: FailedJob[];
}

export function FailedJobsTable({ jobs: initialJobs }: Props) {
  const [jobs, setJobs] = useState<FailedJob[]>(initialJobs);
  const getToken = useAuthToken();

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sin jobs fallidos"
        description="Todos los eventos están siendo procesados correctamente."
      />
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Error</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Intentos</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Correlation ID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {jobs.map((job) => (
            <FailedJobRow
              key={job.id}
              job={job}
              getToken={getToken}
              onRetried={(id) => setJobs((prev) => prev.filter((j) => j.id !== id))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FailedJobRow({
  job,
  getToken,
  onRetried,
}: {
  job: FailedJob;
  getToken: () => Promise<string | null>;
  onRetried: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      try {
        const token = await getToken();
        const result = await retryJob(job.id, token);
        if (result.retried) {
          toast.success('Job reenviado a la cola.');
          onRetried(job.id);
        } else {
          toast.warning('El job no está en estado fallido ya.');
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error al reintentar.';
        toast.error(message);
      }
    });
  }

  const truncatedError =
    job.failedReason.length > 80 ? `${job.failedReason.slice(0, 80)}…` : job.failedReason;

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-xs font-mono">
          {job.eventType ?? job.name}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs hidden sm:table-cell">
        <span title={job.failedReason}>{truncatedError}</span>
      </td>
      <td className="px-4 py-3 text-xs tabular-nums">{job.attemptsMade}</td>
      <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell">
        {job.correlationId ? job.correlationId.slice(0, 8) + '…' : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(job.timestamp).toLocaleString('es-MX', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          disabled={isPending}
          className="text-xs h-7"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          Reintentar
        </Button>
      </td>
    </tr>
  );
}
