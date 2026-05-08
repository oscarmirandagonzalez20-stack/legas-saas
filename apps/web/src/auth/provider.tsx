'use client';

import type { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

// When Clerk keys are configured, replace this with ClerkProvider.
// Keeping the boundary clean so swapping auth providers touches only this file.
export function AuthProvider({ children }: AuthProviderProps) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (clerkKey) {
    // Dynamic import so the build doesn't fail without Clerk keys
    const { ClerkProvider } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
    return (
      <ClerkProvider
        publishableKey={clerkKey}
        appearance={{
          variables: { colorPrimary: '#000000' },
        }}
      >
        {children}
      </ClerkProvider>
    );
  }

  return <>{children}</>;
}
