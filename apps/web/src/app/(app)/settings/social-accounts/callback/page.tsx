import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Conectando cuenta… — Legal SaaS' };

// This page is the returnUrl target for OAuth flows initiated from the onboarding wizard.
// The API callback already handles the real OAuth exchange and redirects here (or to
// /settings/social-accounts directly). This page simply normalises the destination.
export default async function OAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const connected = params.connected;
  const error = params.error;
  const onboarding = params.onboarding;

  const base = onboarding ? '/onboarding' : '/settings/social-accounts';
  const qs = new URLSearchParams();
  if (connected) qs.set('connected', connected);
  if (error) qs.set('error', error);

  redirect(`${base}?${qs.toString()}`);
}
