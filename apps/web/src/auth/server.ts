export interface ServerAuth {
  userId: string;
  orgId: string;
  /** Returns a short-lived JWT to forward to the API, or null in dev bypass mode. */
  getToken: () => Promise<string | null>;
}

const DEV_AUTH: ServerAuth = {
  userId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'dev-user-00000000-0000-0000-0000-000000000001',
  orgId: process.env.NEXT_PUBLIC_DEV_ORG_ID ?? 'dev-org-00000000-0000-0000-0000-000000000001',
  getToken: () => Promise.resolve(null),
};

export async function getServerAuth(): Promise<ServerAuth> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return DEV_AUTH;
  }
  const { auth } = await import('@clerk/nextjs/server');
  const session = await auth();
  if (!session.orgId || !session.userId) {
    throw new Error('Unauthorized');
  }
  return {
    userId: session.userId,
    orgId: session.orgId,
    getToken: session.getToken,
  };
}
