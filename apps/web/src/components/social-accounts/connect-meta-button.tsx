'use client';

import { useState } from 'react';
import { Facebook, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuthToken } from '@/auth/hooks';
import { getConnectMetaUrl } from '@/lib/api/social-accounts';
import { ApiError } from '@/lib/api/types';

export function ConnectMetaButton() {
  const [loading, setLoading] = useState(false);
  const getToken = useAuthToken();

  async function handleClick() {
    setLoading(true);
    try {
      const token = await getToken();
      const returnUrl = `${window.location.origin}/settings/social-accounts`;
      const { url } = await getConnectMetaUrl(token, returnUrl);
      window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al conectar con Meta.';
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <Button onClick={() => { void handleClick(); }} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Facebook className="h-4 w-4" />
      )}
      Conectar Meta
    </Button>
  );
}
