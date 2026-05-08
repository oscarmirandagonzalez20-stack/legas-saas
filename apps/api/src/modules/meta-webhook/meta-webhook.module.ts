import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { HmacVerificationGuard } from './guards/hmac-verification.guard';
import { CommentIngestionService } from './workers/comment-ingestion.service';
import { CommentIngestionWorker } from './workers/comment-ingestion.worker';
import { QueueHealthService } from './workers/queue-health.service';
import { WEBHOOK_QUEUE } from './dto/webhook-job.dto';

@Module({
  imports: [BullModule.registerQueue({ name: WEBHOOK_QUEUE })],
  controllers: [MetaWebhookController],
  providers: [
    MetaWebhookService,
    HmacVerificationGuard,
    CommentIngestionService,
    CommentIngestionWorker,
    QueueHealthService,
  ],
})
export class MetaWebhookModule {}
