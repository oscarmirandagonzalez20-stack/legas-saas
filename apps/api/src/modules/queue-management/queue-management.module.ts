import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from '@/modules/meta-webhook/dto/webhook-job.dto';
import { QueueManagementController } from './queue-management.controller';
import { QueueManagementService } from './queue-management.service';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  controllers: [QueueManagementController],
  providers: [QueueManagementService],
})
export class QueueManagementModule {}
