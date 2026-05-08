'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es-MX">
      <body className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">
            Ocurrió un error inesperado. El equipo ha sido notificado automáticamente.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
