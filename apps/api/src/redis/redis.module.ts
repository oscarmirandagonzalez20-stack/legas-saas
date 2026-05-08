import { Global, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '@/config/env.validation';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  private readonly logger = new Logger('RedisModule');
  readonly client: Redis;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.client = new Redis(url, {
      // BullMQ requires this to be null; for general-purpose clients, use a reasonable default
      maxRetriesPerRequest: 3,
      // Don't queue commands while reconnecting — fail fast so callers can handle errors
      enableOfflineQueue: false,
      // Exponential backoff capped at 3 s; ioredis calls this on each failed connect attempt
      retryStrategy: (times: number) => Math.min(times * 200, 3000),
      lazyConnect: false,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error({ msg: 'Redis error', err: err.message });
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Redis...');
    await this.client.quit();
    this.logger.log('Redis disconnected.');
  }
}

@Global()
@Module({
  providers: [
    RedisLifecycle,
    {
      provide: REDIS_CLIENT,
      inject: [RedisLifecycle],
      useFactory: (lifecycle: RedisLifecycle) => lifecycle.client,
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
