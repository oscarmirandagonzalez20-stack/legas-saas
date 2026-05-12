import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  onModuleInit(): void {
    // Fire-and-forget: do not await so NestJS module init (and app.listen)
    // is not blocked by a slow or temporarily unreachable database.
    // Prisma retries internally; individual queries will fail with a clear
    // error if the DB is still unreachable when they are executed.
    this.$connect().catch((err: unknown) => {
      this.logger.warn(`Initial $connect failed: ${err instanceof Error ? err.message : String(err)} — will retry on first query`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Prisma...');
    await this.$disconnect();
    this.logger.log('Prisma disconnected.');
  }
}
