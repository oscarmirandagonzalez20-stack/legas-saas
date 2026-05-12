// IMPORTANT: Sentry must be imported before any other module so it can
// instrument Node.js internals (http, fs, etc.) before they are first loaded.
import './instrument';
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import type { Readable } from 'stream';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';

// ── Process-level safety net ────────────────────────────────────────────────
// Catches anything that escapes NestJS error handling so Railway gets a
// clean log + non-zero exit code rather than a silent hang or crash loop.
process.on('unhandledRejection', (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[process] unhandledRejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[process] uncaughtException:', err.message, err.stack);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT) || 3000;

  // eslint-disable-next-line no-console
  console.log('[bootstrap] Creating NestJS application...');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
        (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    }),
    { bufferLogs: true },
  );

  // ── Security headers ────────────────────────────────────────────────────────
  // eslint-disable-next-line no-console
  console.log('[bootstrap] Registering security headers...');
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:    ["'self'"],
        scriptSrc:     ["'self'", "'unsafe-inline'"],   // Next.js hydration scripts
        styleSrc:      ["'self'", "'unsafe-inline'"],   // Tailwind inline styles
        imgSrc:        ["'self'", 'data:', 'https:'],
        connectSrc:    ["'self'"],
        frameSrc:      ["'none'"],
        fontSrc:       ["'self'"],
        objectSrc:     ["'none'"],
        baseUri:       ["'self'"],
        formAction:    ["'self'"],
      },
    },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    frameguard: { action: 'deny' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy: true,
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [frontendUrl];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Tenant-Id', 'X-Request-Id'],
  });

  // ── Raw body capture for HMAC verification on the Meta webhook endpoint ─────
  // Must be registered before app.listen() — Fastify seals its plugin container
  // when listen() is called, not during NestFactory.create().
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook(
    'preParsing',
    (request: FastifyRequest, _reply, payload: Readable, done) => {
      const pt = new PassThrough();
      const chunks: Buffer[] = [];
      pt.on('data', (chunk: Buffer) => chunks.push(chunk));
      pt.on('end', () => {
        request.rawBody = Buffer.concat(chunks);
      });
      payload.pipe(pt);
      done(null, pt as unknown as Readable);
    },
  );

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // eslint-disable-next-line no-console
  console.log('PORT:', port);
  // eslint-disable-next-line no-console
  console.log('HOST: 0.0.0.0');

  await app.listen(port, '0.0.0.0');

  // eslint-disable-next-line no-console
  console.log('Healthcheck ready');
}

// Explicit .catch so Railway logs show a clear fatal error if bootstrap
// fails, rather than an unhandled rejection with no context.
void bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] Fatal error during startup:', err);
  process.exit(1);
});
