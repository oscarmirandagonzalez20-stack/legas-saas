import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import type { LeadListResponse, LeadStage } from '@/lib/api/types';

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  WHATSAPP_INITIATED: 'WhatsApp',
  CONSULTATION_SCHEDULED: 'Cita agendada',
  CONSULTATION_PAID: 'Cita pagada',
  CLIENT: 'Cliente',
  LOST: 'Perdido',
};

const STAGE_VARIANT: Record<LeadStage, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  NEW: 'default',
  CONTACTED: 'warning',
  WHATSAPP_INITIATED: 'warning',
  CONSULTATION_SCHEDULED: 'success',
  CONSULTATION_PAID: 'success',
  CLIENT: 'success',
  LOST: 'error',
};

interface LeadsTableProps {
  result: LeadListResponse;
  currentPage: number;
}

export function LeadsTable({ result, currentPage }: LeadsTableProps) {
  const { data: leads, total, pages } = result;

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Sin leads"
        description="Cuando se detecten comentarios con intención de contratar, aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {total} resultado{total !== 1 ? 's' : ''}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Etapa</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Área</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Etiquetas</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{lead.displayName ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{lead.externalUserId}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STAGE_VARIANT[lead.stage] ?? 'outline'}>
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {lead.areaLegal ?? '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString('es-MX')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground text-xs">
            Página {currentPage} de {pages}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}>
              <Link href={`?page=${currentPage - 1}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={currentPage >= pages}>
              <Link href={`?page=${currentPage + 1}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
