import type { ElementType } from 'react';
import { Activity, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QueueStats } from '@/lib/api/types';

interface Props {
  stats: QueueStats | null;
}

export function QueueStatsCard({ stats }: Props) {
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          No se pudo obtener el estado de la cola.
        </CardContent>
      </Card>
    );
  }

  const isDegraded = stats.failed > 0 && stats.failed < 10;
  const isCritical = stats.failed >= 10 || stats.paused;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">webhook-processing</p>
            {stats.paused && <Badge variant="warning">Pausada</Badge>}
          </div>
          <QueueHealthBadge degraded={isDegraded} critical={isCritical} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatItem icon={Activity} label="Activos" value={stats.active} />
          <StatItem icon={Clock} label="En espera" value={stats.waiting} />
          <StatItem icon={Clock} label="Diferidos" value={stats.delayed} />
          <StatItem
            icon={AlertCircle}
            label="Fallidos"
            value={stats.failed}
            alert={stats.failed > 0}
          />
          <StatItem icon={CheckCircle} label="Completados" value={stats.completed} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatItem({
  icon,
  label,
  value,
  alert,
}: {
  icon: ElementType;
  label: string;
  value: number;
  alert?: boolean;
}) {
  const Icon = icon;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className={`h-3 w-3 ${alert ? 'text-red-500' : ''}`} />
        {label}
      </div>
      <p className={`text-xl font-semibold tabular-nums ${alert && value > 0 ? 'text-red-600' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function QueueHealthBadge({
  degraded,
  critical,
}: {
  degraded: boolean;
  critical: boolean;
}) {
  if (critical) return <Badge variant="error">Crítico</Badge>;
  if (degraded) return <Badge variant="warning">Degradado</Badge>;
  return <Badge variant="success">Saludable</Badge>;
}
