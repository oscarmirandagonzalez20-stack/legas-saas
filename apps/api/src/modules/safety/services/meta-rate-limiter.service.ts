import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.module';
import type { RateLimitResult } from '../safety.types';

// Fixed-window rate limiter backed by Redis INCR + EXPIRE.
// A fixed window can allow a burst at window boundaries (2x in worst case);
// for human-safety rate limiting that is acceptable and far simpler to test.

@Injectable()
export class MetaRateLimiterService {
  private readonly logger = new Logger(MetaRateLimiterService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async checkAndIncrement(
    key: string,
    windowSecs: number,
    limit: number,
  ): Promise<RateLimitResult> {
    const bucket = Math.floor(Date.now() / (windowSecs * 1_000));
    const fullKey = `safety:rl:${key}:${String(bucket)}`;

    const count = await this.redis.incr(fullKey);
    if (count === 1) {
      // First entry in this bucket — set TTL so keys self-clean
      await this.redis.expire(fullKey, windowSecs + 60);
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = (bucket + 1) * windowSecs * 1_000;

    if (!allowed) {
      this.logger.warn(
        `Rate limit exceeded: key=${key} window=${String(windowSecs)}s count=${String(count)}/${String(limit)}`,
      );
    }

    return { allowed, remaining, resetAt, limitKey: key };
  }

  async checkAccountMsgPerMin(accountId: string, limit: number): Promise<RateLimitResult> {
    return this.checkAndIncrement(`acct:${accountId}:msg:min`, 60, limit);
  }

  async checkAccountMsgPerHour(accountId: string, limit: number): Promise<RateLimitResult> {
    return this.checkAndIncrement(`acct:${accountId}:msg:hr`, 3_600, limit);
  }

  async checkAccountMsgPerDay(accountId: string, limit: number): Promise<RateLimitResult> {
    return this.checkAndIncrement(`acct:${accountId}:msg:day`, 86_400, limit);
  }

  async checkDmsPerHour(accountId: string, limit: number): Promise<RateLimitResult> {
    return this.checkAndIncrement(`acct:${accountId}:dm:hr`, 3_600, limit);
  }

  async checkCommentRepliesPerHour(accountId: string, limit: number): Promise<RateLimitResult> {
    return this.checkAndIncrement(`acct:${accountId}:comment:hr`, 3_600, limit);
  }

  async checkResponsesPerUser(
    accountId: string,
    recipientUserId: string,
    limit: number,
  ): Promise<RateLimitResult> {
    return this.checkAndIncrement(`user:${accountId}:${recipientUserId}:day`, 86_400, limit);
  }

  async checkResponsesPerConversation(
    conversationId: string,
    limit: number,
  ): Promise<RateLimitResult> {
    return this.checkAndIncrement(`conv:${conversationId}:day`, 86_400, limit);
  }
}
