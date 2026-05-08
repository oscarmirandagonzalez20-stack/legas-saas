import { randomUUID } from 'crypto';
import { Body, Controller, Get, Headers, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { metaWebhookRawSchema, type MetaWebhookRaw } from './dto/meta-webhook-raw.dto';
import { HmacVerificationGuard } from './guards/hmac-verification.guard';
import { MetaWebhookService } from './meta-webhook.service';

// Meta retries aggressively (up to 20 times over 3 days). Rate limiting is
// handled by HMAC signature verification — not by IP-based throttling.
@SkipThrottle()
@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(private readonly webhookService: MetaWebhookService) {}

  // Meta calls GET to verify the webhook subscription
  @Get()
  verifyWebhook(@Query() query: Record<string, string>): string {
    return this.webhookService.verifyWebhook(query);
  }

  // Meta calls POST for all webhook events — HMAC guard verifies signature first
  @Post()
  @HttpCode(200)
  @UseGuards(HmacVerificationGuard)
  async receiveWebhook(
    @Body(new ZodValidationPipe(metaWebhookRawSchema)) body: MetaWebhookRaw,
    @Headers('x-request-id') xRequestId?: string,
    @Headers('x-correlation-id') xCorrelationId?: string,
  ): Promise<void> {
    const correlationId = xRequestId ?? xCorrelationId ?? randomUUID();
    await this.webhookService.handleWebhook(body, correlationId);
  }
}
