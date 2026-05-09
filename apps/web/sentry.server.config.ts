import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0,
});
