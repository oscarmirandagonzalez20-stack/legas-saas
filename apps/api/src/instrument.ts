// Sentry must be initialized before any other imports so it can patch Node internals.
// This file is the FIRST import in main.ts.
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Disable when no DSN is configured (dev / test environments)
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  // No performance monitoring for MVP — error capture only
  tracesSampleRate: 0,
});
