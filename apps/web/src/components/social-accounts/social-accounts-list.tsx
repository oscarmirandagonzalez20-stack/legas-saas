'use client';

import { useState, useTransition } from 'react';
import { Facebook, Instagram, AlertCircle, CheckCircle, Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { useAuthToken } from '@/auth/hooks';
import {
  disconnectSocialAccount,
  getReconnectUrl,
} from '@/lib/api/social-accounts';
import type { SocialAccount } from '@/lib/api/types';
import { ApiError } from '@/lib/api/types';
import { EmptyState } from '@/components/empty-state';

interface Props {
  initialAccounts: SocialAccount[];
}

export function SocialAccountsList({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<SocialAccount[]>(initialAccounts);
  const getToken = useAuthToken();

  function handleDisconnected(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Facebook}
        title="Sin cuentas conectadas"
        description='Haz clic en "Conectar Meta" para vincular tu página de Facebook.'
      />
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <SocialAccountCard
          key={account.id}
          account={account}
          getToken={getToken}
          onDisconnected={handleDisconnected}
        />
      ))}
    </div>
  );
}

function SocialAccountCard({
  account,
  getToken,
  onDisconnected,
}: {
  account: SocialAccount;
  getToken: () => Promise<string | null>;
  onDisconnected: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reconnecting, setReconnecting] = useState(false);

  const isFacebook = account.platform === 'FACEBOOK';
  const Icon = isFacebook ? Facebook : Instagram;
  const isOperational = account.status === 'ACTIVE' && account.webhookSubscribedAt !== null;
  const hasWebhookError = account.webhookSubscriptionError !== null;

  function handleDisconnect() {
    startTransition(async () => {
      try {
        const token = await getToken();
        await disconnectSocialAccount(account.id, token);
        toast.success(`${account.displayName} desconectado.`);
        onDisconnected(account.id);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error al desconectar.';
        toast.error(message);
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  async function handleReconnect() {
    setReconnecting(true);
    try {
      const token = await getToken();
      const { url } = await getReconnectUrl(account.id, token);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al reconectar.';
      toast.error(message);
      setReconnecting(false);
    }
  }

  return (
    <>
      <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
        {/* Platform icon */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isFacebook ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{account.displayName}</p>
            <AccountStatusBadge
              status={account.status}
              isOperational={isOperational}
              hasWebhookError={hasWebhookError}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            ID: {account.externalId}
          </p>
          {hasWebhookError && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Webhook: {account.webhookSubscriptionError}
            </p>
          )}
          {account.tokenExpiresAt && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              Expira: {new Date(account.tokenExpiresAt).toLocaleDateString('es-MX')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {(account.status === 'REVOKED' || account.status === 'ERROR' || hasWebhookError) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleReconnect(); }}
              disabled={reconnecting}
            >
              {reconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Reconectar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="sr-only">Desconectar</span>
          </Button>
        </div>
      </div>

      {/* Disconnect confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desconectar {account.displayName}?</DialogTitle>
            <DialogDescription>
              Se revocará el acceso a esta página. Los leads y conversaciones existentes
              no se eliminarán, pero no se detectarán nuevos comentarios.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Desconectar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountStatusBadge({
  status,
  isOperational,
  hasWebhookError,
}: {
  status: string;
  isOperational: boolean;
  hasWebhookError: boolean;
}) {
  if (status === 'REVOKED') {
    return <Badge variant="error">Revocado</Badge>;
  }
  if (status === 'ERROR') {
    return <Badge variant="error">Error</Badge>;
  }
  if (hasWebhookError) {
    return <Badge variant="warning">Webhook error</Badge>;
  }
  if (isOperational) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Operativo
      </Badge>
    );
  }
  return <Badge variant="warning">Conectado</Badge>;
}

export function SocialAccountsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-start gap-4 rounded-xl border p-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
