import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
