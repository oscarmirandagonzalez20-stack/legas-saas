import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { getServerAuth } from '@/auth/server';
import { listConversations } from '@/lib/api/conversations';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import type { ConversationStatus, LeadStage } from '@/lib/api/types';

export const metadata: Metadata = { title: 'Bandeja — Legal SaaS' };

const STATUS_VARIANT: Record<ConversationStatus, 'default' | 'success' | 'outline' | 'error'> = {
  ACTIVE: 'success',
  ARCHIVED: 'outline',
  CLOSED: 'outline',
};

const STAGE_LABELS: Partial<Record<LeadStage, string>> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  WHATSAPP_INITIATED: 'WhatsApp enviado',
  CONSULTATION_SCHEDULED: 'Cita agendada',
  CONSULTATION_PAID: 'Cita pagada',
  CLIENT: 'Cliente',
  LOST: 'Perdido',
};

export default async function InboxPage() {
  const auth = await getServerAuth();
  const token = await auth.getToken();

  const conversations = await listConversations(token).catch(() => []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Bandeja</h1>
        <p className="text-sm text-muted-foreground">
          Conversaciones activas con prospectos.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Bandeja vacía"
          description="Las conversaciones aparecerán aquí cuando se envíe el primer mensaje a un lead."
        />
      ) : (
        <div className="rounded-xl border divide-y overflow-hidden">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/inbox/${conv.id}`}
              className="flex items-start gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {conv.lead?.displayName ?? `Lead ${conv.leadId.slice(0, 8)}…`}
                  </p>
                  {conv.lead?.stage && (
                    <span className="text-xs text-muted-foreground">
                      {STAGE_LABELS[conv.lead.stage] ?? conv.lead.stage}
                    </span>
                  )}
                  {conv.humanOwned && (
                    <Badge variant="warning" className="text-xs">
                      Atención humana
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {conv.lead?.areaLegal && (
                    <p className="text-xs text-muted-foreground">{conv.lead.areaLegal}</p>
                  )}
                  {!conv.in24hWindow && (
                    <p className="text-xs text-amber-600">Fuera de ventana 24h</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={STATUS_VARIANT[conv.status] ?? 'outline'} className="text-xs">
                  {conv.status === 'ACTIVE' ? 'Activa' : conv.status === 'ARCHIVED' ? 'Archivada' : 'Cerrada'}
                </Badge>
                {conv.lastMessageAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(conv.lastMessageAt).toLocaleDateString('es-MX')}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
