'use client';

export interface AuthUser {
  userId: string;
  orgId: string;
  orgName?: string;
}

// ── Dev bypass (no Clerk keys configured) ────────────────────────────────────

function useDevCurrentUser(): AuthUser {
  return {
    userId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user-00000000-0000-0000-0000-000000000001',
    orgId: process.env.NEXT_PUBLIC_DEV_ORG_ID ?? 'dev-org-00000000-0000-0000-0000-000000000001',
    orgName: 'Despacho Dev',
  };
}

function useDevAuthToken(): () => Promise<string | null> {
  return () => Promise.resolve(null);
}

// ── Clerk implementations (only compiled in when key is present) ──────────────

// These two functions live in a separate module so the import of @clerk/nextjs
// is never bundled when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is absent.
// They are loaded dynamically at module init time (not inside a render), which is
// safe — the selection happens once, not per render.
type UseCurrentUser = () => AuthUser;
type UseAuthToken = () => () => Promise<string | null>;

function loadClerkHooks(): { useCurrentUser: UseCurrentUser; useAuthToken: UseAuthToken } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require('@clerk/nextjs') as {
    useAuth: () => { orgId: string | null | undefined; getToken: () => Promise<string | null> };
    useUser: () => { user: { id: string; organizationMemberships?: Array<{ organization: { name: string } }> } | null | undefined };
  };

  function useCurrentUser(): AuthUser {
    const { orgId } = clerk.useAuth();
    const { user } = clerk.useUser();
    return {
      userId: user?.id ?? '',
      orgId: orgId ?? '',
      orgName: user?.organizationMemberships?.[0]?.organization.name,
    };
  }

  function useAuthToken(): () => Promise<string | null> {
    const { getToken } = clerk.useAuth();
    return getToken;
  }

  return { useCurrentUser, useAuthToken };
}

// ── Public API ────────────────────────────────────────────────────────────────

const IS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const clerkHooks = IS_CLERK ? loadClerkHooks() : null;

export function useCurrentUser(): AuthUser {
  // When IS_CLERK is false this is the only branch that ever executes.
  // When IS_CLERK is true the clerkHooks branch is always taken.
  // The NEXT_PUBLIC_ constant is baked at build time so only one branch
  // ends up in the bundle — no conditional hook call at runtime.
  if (!IS_CLERK || !clerkHooks) return useDevCurrentUser();
  return clerkHooks.useCurrentUser();
}

export function useAuthToken(): () => Promise<string | null> {
  if (!IS_CLERK || !clerkHooks) return useDevAuthToken();
  return clerkHooks.useAuthToken();
}
