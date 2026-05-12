import { createHash } from 'crypto';
import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.module';

const DEDUP_TTL_SECS = 86_400;        // Exact duplicates blocked for 24 h
const TEMPLATE_WINDOW_SECS = 3_600;   // Template usage counter resets hourly
const TEMPLATE_ROTATION_LIMIT = 3;    // Max same-template sends per hour per account

@Injectable()
export class AntiSpamService {
  private readonly logger = new Logger(AntiSpamService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // Normalize + hash content so minor whitespace/punctuation differences are
  // treated as the same message (prevents trivial bypass by adding a space).
  contentHash(content: string): string {
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,!?¡¿;:]/g, '')
      .trim();
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  async isDuplicateMessage(
    accountId: string,
    conversationId: string,
    content: string,
  ): Promise<boolean> {
    const hash = this.contentHash(content);
    const key = `safety:spam:${accountId}:${conversationId}:${hash}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async recordSentMessage(
    accountId: string,
    conversationId: string,
    content: string,
  ): Promise<void> {
    const hash = this.contentHash(content);
    const key = `safety:spam:${accountId}:${conversationId}:${hash}`;
    await this.redis.setex(key, DEDUP_TTL_SECS, '1');
  }

  // Track template rotation — prevent sending the same template too frequently.
  async isTemplateOverused(accountId: string, templateId: string): Promise<boolean> {
    const key = `safety:tpl:${accountId}:${templateId}`;
    const val = await this.redis.get(key);
    return val !== null && parseInt(val, 10) >= TEMPLATE_ROTATION_LIMIT;
  }

  async recordTemplateSent(accountId: string, templateId: string): Promise<void> {
    const key = `safety:tpl:${accountId}:${templateId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, TEMPLATE_WINDOW_SECS);
    }
    this.logger.debug(
      `Template ${templateId} used ${String(count)}x this hour (account ${accountId})`,
    );
  }
}
