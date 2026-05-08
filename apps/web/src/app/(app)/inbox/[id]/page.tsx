import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { getServerAuth } from '@/auth/server';
import { getConversation, listMessages } from '@/lib/api/conversations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LeadStage } from '@/lib/api/types';

export const metadata: Metadata = { title: 'Conversación — Legal SaaS' };

const STAGE_LABELS: Partial<Record<LeadStage, string>> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  WHATSAPP_INITIATED: 'WhatsApp enviado',
  CONSULTATION_SCHEDULED: 'Cita agendada',
  CONSULTATION_PAID: 'Cita pagada',
  CLIENT: 'Cliente',
  LOST: 'Perdido',
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await getServerAuth();
  const token = await auth.getToken();

  const [conv, messages] = await Promise.allSettled([
    getConversation(id, token),
    listMessages(id, token),
  ]);

  if (conv.status === 'rejected') {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Conversación no encontrada.
        </div>
      </div>
    );
  }

  const conversation = conv.value;
  const msgs = messages.status === 'fulfilled' ? messages.value : [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">
              {conversation.lead?.displayName ?? `Lead ${conversation.leadId.slice(0, 8)}…`}
            </p>
            {conversation.lead?.stage && (
              <Badge variant="outline" className="text-xs">
                {STAGE_LABELS[conversation.lead.stage] ?? conversation.lead.stage}
              </Badge>
            )}
            {conversation.humanOwned && (
              <Badge variant="warning" className="text-xs">Atención humana</Badge>
            )}
          </div>
          {conversation.lead?.areaLegal && (
            <p className="text-xs text-muted-foreground">{conversation.lead.areaLegal}</p>
          )}
        </div>
      </div>

      {/* 24h window warning */}
      {!conversation.in24hWindow && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Fuera de ventana de 24 horas. Solo se pueden enviar plantillas pre-aprobadas.
        </div>
      )}

      {/* Messages — readonly */}
      <div className="flex-1 rounded-xl border overflow-y-auto p-4 space-y-3 bg-muted/20 min-h-0">
        {msgs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes todavía.</p>
        )}
        {msgs.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-sm rounded-lg px-3 py-2 text-sm ${
                msg.direction === 'OUTBOUND'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
              <p className="mt-1 text-[10px] opacity-60">
                {new Date(msg.createdAt).toLocaleString('es-MX', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {msg.readAt && ' · Leído'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        Vista de solo lectura. Las respuestas automáticas son gestionadas por el sistema.
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/inbox">
        <ChevronLeft className="h-4 w-4" />
        Bandeja
      </Link>
    </Button>
  );
}
