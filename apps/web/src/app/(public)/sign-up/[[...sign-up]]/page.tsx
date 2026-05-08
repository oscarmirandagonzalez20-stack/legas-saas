import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Crear cuenta — Legal SaaS' };

export default function SignUpPage() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { SignUp } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
    return <SignUp />;
  }

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow">
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="text-sm text-muted-foreground">
        Modo desarrollo — Clerk no configurado.{' '}
        <a href="/leads" className="underline">
          Entrar directamente →
        </a>
      </p>
    </div>
  );
}
