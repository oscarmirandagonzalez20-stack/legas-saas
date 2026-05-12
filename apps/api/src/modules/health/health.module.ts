import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { SaludController } from './salud.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import { QueueHealthIndicator } from './indicators/queue-health.indicator';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  controllers: [HealthController, SaludController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
