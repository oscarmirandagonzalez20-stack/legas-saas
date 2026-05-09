import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Iniciar sesión — Legal SaaS' };

export default function SignInPage() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const { SignIn } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
    return <SignIn />;
  }

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow">
      <h1 className="mb-1 text-xl font-semibold">Legal SaaS</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Modo desarrollo — Clerk no configurado.
      </p>
      <a
        href="/leads"
        className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Entrar sin autenticación →
      </a>
    </div>
  );
}
