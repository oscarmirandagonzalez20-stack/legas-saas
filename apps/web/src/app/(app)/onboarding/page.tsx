import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata: Metadata = { title: 'Bienvenido — Legal SaaS' };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center">
      <OnboardingWizard />
    </div>
  );
}
