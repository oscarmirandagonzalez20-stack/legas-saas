'use client';

import { useState } from 'react';
import { CheckCircle, Facebook, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthToken } from '@/auth/hooks';
import { getConnectMetaUrl } from '@/lib/api/social-accounts';
import { ApiError } from '@/lib/api/types';

const STEPS = [
  { id: 1, title: 'Tu cuenta', description: 'Despacho configurado correctamente.' },
  { id: 2, title: 'Conectar Facebook', description: 'Vincula tu página de Facebook e Instagram.' },
  { id: 3, title: 'Listo', description: 'Tu despacho está operativo.' },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const getToken = useAuthToken();

  async function handleConnectMeta() {
    setConnecting(true);
    try {
      const token = await getToken();
      const returnUrl = `${window.location.origin}/settings/social-accounts?onboarding=1`;
      const { url } = await getConnectMetaUrl(token, returnUrl);
      window.location.href = url;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Error al iniciar conexión con Meta.';
      toast.error(message);
      setConnecting(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">Configuración inicial</CardTitle>
        <CardDescription>
          Sigue los pasos para empezar a captar leads desde Meta.
        </CardDescription>
      </CardHeader>

      {/* Step indicators */}
      <div className="flex items-center gap-2 px-6 pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step > s.id
                  ? 'bg-emerald-500 text-white'
                  : step === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">{s.title}</span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${step > s.id ? 'bg-emerald-500' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <CardContent className="pt-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Cuenta creada correctamente</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tu despacho está registrado en la plataforma. El siguiente paso es conectar
                tu página de Facebook para empezar a detectar leads.
              </p>
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continuar <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">¿Qué necesitas?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                <li>Una página de Facebook conectada a tu despacho</li>
                <li>Permisos de administrador en esa página</li>
                <li>Opcionalmente, una cuenta de Instagram Business vinculada</li>
              </ul>
            </div>
            <Button
              className="w-full"
              onClick={() => { void handleConnectMeta(); }}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirigiendo a Facebook…
                </>
              ) : (
                <>
                  <Facebook className="h-4 w-4" />
                  Conectar con Facebook
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(1)}>
              Atrás
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">¡Tu despacho está operativo!</p>
            <p className="text-sm text-muted-foreground">
              Ahora puedes monitorear leads desde el dashboard principal.
            </p>
            <Button className="w-full" asChild>
              <a href="/leads">Ir al dashboard →</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
