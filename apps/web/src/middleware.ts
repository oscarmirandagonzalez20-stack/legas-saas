import { type NextRequest, NextResponse } from 'next/server';

const IS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// When Clerk is enabled, this module is replaced at build time with Clerk's middleware.
// When disabled (dev bypass), all routes are allowed through.
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!IS_CLERK) {
    const response = NextResponse.next();
    const devOrgId =
      process.env.NEXT_PUBLIC_DEV_ORG_ID ?? 'dev-org-00000000-0000-0000-0000-000000000001';
    response.headers.set('x-dev-org-id', devOrgId);
    return response;
  }

  // Production: Clerk handles auth. This branch is compiled away when IS_CLERK=false.
  const { clerkMiddleware, createRouteMatcher } =
    await import('@clerk/nextjs/server');

  const isProtected = createRouteMatcher([
    '/(app)(.*)',
    '/onboarding(.*)',
    '/leads(.*)',
    '/inbox(.*)',
    '/contacts(.*)',
    '/settings(.*)',
  ]);

  return (clerkMiddleware(async (auth, req) => {
    if (isProtected(req)) await auth.protect();
  }) as (req: NextRequest) => Promise<NextResponse>)(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
