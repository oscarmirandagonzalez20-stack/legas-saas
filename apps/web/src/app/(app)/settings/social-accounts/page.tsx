import type { Metadata } from 'next';
import { getServerAuth } from '@/auth/server';
import { listSocialAccounts } from '@/lib/api/social-accounts';
import { SocialAccountsList } from '@/components/social-accounts/social-accounts-list';
import { ConnectMetaButton } from '@/components/social-accounts/connect-meta-button';

export const metadata: Metadata = { title: 'Cuentas Meta — Legal SaaS' };

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const auth = await getServerAuth();
  const token = await auth.getToken();
  const params = await searchParams;

  let accounts = await listSocialAccounts(token).catch(() => []);

  const connected = params.connected ? Number(params.connected) : null;
  const error = params.error ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cuentas Meta</h1>
          <p className="text-sm text-muted-foreground">
            Conecta tu página de Facebook e Instagram Business para captar leads.
          </p>
        </div>
        <ConnectMetaButton />
      </div>

      {/* OAuth feedback banners */}
      {connected !== null && connected > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
          {connected} cuenta{connected !== 1 ? 's' : ''} conectada{connected !== 1 ? 's' : ''} correctamente.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {friendlyError(error)}
        </div>
      )}

      <SocialAccountsList initialAccounts={accounts} />
    </div>
  );
}

function friendlyError(code: string): string {
  const MESSAGES: Record<string, string> = {
    access_denied: 'Cancelaste la conexión con Facebook.',
    missing_params: 'La respuesta de Facebook fue inválida. Intenta de nuevo.',
    conflict: 'Esta página ya está conectada en otro despacho.',
  };
  return MESSAGES[code] ?? `Error al conectar: ${code}`;
}
