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

// ── Diagnostic helpers ──────────────────────────────────────────────────────
// These run before pino is wired. After DI, NestJS logger takes over.
const t0 = Date.now();
const ts = (): string => `[${new Date().toISOString()}] [+${String(Date.now() - t0)}ms]`;
const mask = (v: string | undefined, visible = 30): string =>
  v ? `${v.slice(0, visible)}… (len=${String(v.length)})` : 'NOT SET';

// ── Process-level safety net ────────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  console.error(`${ts()} [FATAL] unhandledRejection:`, reason);
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  console.error(`${ts()} [FATAL] uncaughtException:`, err.message, err.stack);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT) || 3000;

  // ── Full env snapshot ───────────────────────────────────────────────────
  console.warn(`${ts()} ═══════════════ BOOTSTRAP START ═══════════════`);
  console.warn(`${ts()} [env] NODE_ENV       = ${process.env.NODE_ENV ?? 'NOT SET'}`);
  console.warn(`${ts()} [env] PORT           = ${process.env.PORT ?? 'NOT SET'} → will listen on ${String(port)}`);
  console.warn(`${ts()} [env] DATABASE_URL   = ${mask(process.env.DATABASE_URL)}`);
  console.warn(`${ts()} [env] REDIS_URL      = ${mask(process.env.REDIS_URL)}`);
  console.warn(`${ts()} [env] ENCRYPTION_KEY = ${process.env.ENCRYPTION_KEY ? `[SET len=${String(process.env.ENCRYPTION_KEY.length)}]` : 'NOT SET (empty string default)'}`);
  console.warn(`${ts()} [env] FRONTEND_URL   = ${process.env.FRONTEND_URL ?? 'NOT SET'}`);
  console.warn(`${ts()} [env] CLERK_SECRET   = ${process.env.CLERK_SECRET_KEY ? '[SET]' : 'NOT SET'}`);
  console.warn(`${ts()} [env] SENTRY_DSN     = ${process.env.SENTRY_DSN ? '[SET]' : 'NOT SET'}`);

  // ── Hang alarm — fires if bootstrap stalls for >45s ─────────────────────
  const hangAlarm = setTimeout(() => {
    console.error(`${ts()} [HANG] Bootstrap has NOT completed after 45s`);
    console.error(`${ts()} [HANG] Possible causes: BullMQ waiting for Redis / Prisma blocking / circular DI`);
  }, 45_000);
  hangAlarm.unref();

  // ── Step 1: NestJS DI ───────────────────────────────────────────────────
  console.warn(`${ts()} [1/6] NestFactory.create — running DI + module init...`);
  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: false,
        genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
      }),
      { bufferLogs: true },
    );
  } catch (err: unknown) {
    console.error(`${ts()} [1/6] FAILED — NestFactory.create threw:`, err);
    console.error(`${ts()} [1/6] Likely: env validation rejected DATABASE_URL/REDIS_URL, or DI error`);
    process.exit(1);
  }
  console.warn(`${ts()} [1/6] ✓ NestJS app created — DI complete`);

  // ── Step 2: helmet ──────────────────────────────────────────────────────
  console.warn(`${ts()} [2/6] Registering Fastify plugins (helmet)...`);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'https:'],
        connectSrc:  ["'self'"],
        frameSrc:    ["'none'"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
      },
    },
    hsts:           { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff:        true,
    frameguard:     { action: 'deny' },
    permittedCrossDomainPolicies: false,
    hidePoweredBy:  true,
  });
  console.warn(`${ts()} [2/6] ✓ helmet registered`);

  // ── Step 3: CORS ────────────────────────────────────────────────────────
  console.warn(`${ts()} [3/6] Configuring CORS...`);
  const frontendUrl = process.env.FRONTEND_URL ?? '';
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : frontendUrl
    ? [frontendUrl]
    : [];
  console.warn(`${ts()} [3/6] CORS origins: ${corsOrigins.length ? corsOrigins.join(', ') : '(none — Railway healthcheck probe has no Origin header, works regardless)'}`);
  app.enableCors({
    origin:         corsOrigins.length ? corsOrigins : false,
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Tenant-Id', 'X-Request-Id'],
  });
  console.warn(`${ts()} [3/6] ✓ CORS configured`);

  // ── Step 4: Raw body hook (HMAC for Meta webhooks) ──────────────────────
  console.warn(`${ts()} [4/6] Adding preParsing raw-body hook...`);
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook(
    'preParsing',
    (request: FastifyRequest, _reply, payload: Readable, done) => {
      const pt = new PassThrough();
      const chunks: Buffer[] = [];
      pt.on('data', (chunk: Buffer) => chunks.push(chunk));
      pt.on('end', () => { request.rawBody = Buffer.concat(chunks); });
      payload.pipe(pt);
      done(null, pt as unknown as Readable);
    },
  );
  console.warn(`${ts()} [4/6] ✓ raw-body hook registered`);

  // ── Step 5: Pino logger + shutdown hooks ────────────────────────────────
  console.warn(`${ts()} [5/6] Wiring pino logger + shutdown hooks...`);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  console.warn(`${ts()} [5/6] ✓ logger and shutdown hooks ready`);

  // ── Step 6: Listen ──────────────────────────────────────────────────────
  console.warn(`${ts()} [6/6] Calling app.listen(${String(port)}, '0.0.0.0')...`);
  try {
    await app.listen(port, '0.0.0.0');
  } catch (err: unknown) {
    console.error(`${ts()} [6/6] FAILED — app.listen threw:`, err);
    console.error(`${ts()} [6/6] Check port ${String(port)} binding or Fastify plugin error`);
    process.exit(1);
  }

  clearTimeout(hangAlarm);
  console.warn(`${ts()} [6/6] ✓ LISTENING on 0.0.0.0:${String(port)}`);
  console.warn(`${ts()} [6/6] ✓ Health endpoint ready: GET /salud → { ok: true }`);
  console.warn(`${ts()} ══════ BOOTSTRAP COMPLETE — GET /salud → 200 { ok: true } ══════`);
}

void bootstrap().catch((err: unknown) => {
  console.error(`${ts()} [FATAL] Unhandled bootstrap error:`, err);
  process.exit(1);
});
