import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import Redis from 'ioredis';
import { validateEnv, type Env } from '@/config/env.validation';
import { AppConfigModule } from '@/config/app-config.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';
import { RequestContextModule } from '@/common/request-context/request-context.module';
import { TenantContextModule } from '@/common/tenant-context/tenant-context.module';
import { RequestIdInterceptor } from '@/common/interceptors/request-id.interceptor';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { FastifyThrottlerGuard } from '@/common/guards/throttler.guard';
import { HealthModule } from '@/modules/health/health.module';
import { MetricsModule } from '@/modules/metrics/metrics.module';
import { LeadModule } from '@/modules/leads/lead.module';
import { MetaWebhookModule } from '@/modules/meta-webhook/meta-webhook.module';
import { MetaOAuthModule } from '@/modules/meta-oauth/meta-oauth.module';
import { SocialAccountsModule } from '@/modules/social-accounts/social-accounts.module';
import { ConversationsModule } from '@/modules/conversations/conversations.module';
import { QueueManagementModule } from '@/modules/queue-management/queue-management.module';
import { SafetyModule } from '@/modules/safety/safety.module';
import { requestContextStorage } from '@/common/request-context/request-context.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // Rate limiting — defaults applied globally via FastifyThrottlerGuard.
    // Individual controllers/routes override with @Throttle() or @SkipThrottle().
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },   // 120 req / min
      { name: 'strict',  ttl: 60_000, limit: 20 },    // 20 req / min (auth, retries)
    ]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connection = new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: null,  // required by BullMQ
          enableOfflineQueue: false,
          retryStrategy: (times: number) => Math.min(times * 200, 3000),
        });
        // BullMQ attaches its own error listener, but adding a defensive no-op here
        // prevents an unhandled 'error' event crash if Redis is temporarily unreachable
        // in the brief window before BullMQ registers its listener.
        connection.on('error', () => undefined);
        return { connection };
      },
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
            : undefined,
        genReqId: (req) =>
          (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
        mixin: () => {
          const ctx = requestContextStorage.getStore();
          return ctx ? { requestId: ctx.requestId } : {};
        },
      },
    }),

    AppConfigModule,
    PrismaModule,
    RedisModule,
    SafetyModule,
    RequestContextModule,
    TenantContextModule,
    HealthModule,
    MetricsModule,
    LeadModule,
    MetaWebhookModule,
    MetaOAuthModule,
    SocialAccountsModule,
    ConversationsModule,
    QueueManagementModule,
  ],
  providers: [
    { provide: APP_FILTER,      useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    // Global rate limit — webhook endpoint uses @SkipThrottle() to bypass
    { provide: APP_GUARD,       useClass: FastifyThrottlerGuard },
  ],
})
export class AppModule {}
