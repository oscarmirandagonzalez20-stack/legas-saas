import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.module';
import type { BaseLimits, EffectiveLimits } from '../safety.types';

const TRUST_KEY = (id: string): string => `safety:acct:${id}:trust`;
const WARMUP_KEY = (id: string): string => `safety:acct:${id}:warmup`;
const PAUSE_KEY = (id: string): string => `safety:acct:${id}:pause`;

const INITIAL_TRUST = 50;
const MIN_TRUST = 0;
const MAX_TRUST = 100;
const SUCCESS_INC = 1;
const FAILURE_DEC = 10;
const LOW_TRUST_THRESHOLD = 20;
const AUTO_PAUSE_SECS = 3_600; // 1 hour

// Warmup schedule: days since first connect → fraction of base limits
const WARMUP: readonly { days: number; factor: number }[] = [
  { days: 0, factor: 0.10 }, // Days 0-2
  { days: 2, factor: 0.25 }, // Days 2-4
  { days: 4, factor: 0.50 }, // Days 4-6
  { days: 6, factor: 0.75 }, // Days 6-8
  { days: 8, factor: 1.00 }, // Day 8+ — full limits
];

@Injectable()
export class AccountProtectionService {
  private readonly logger = new Logger(AccountProtectionService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getTrustScore(accountId: string): Promise<number> {
    const val = await this.redis.get(TRUST_KEY(accountId));
    return val !== null ? parseInt(val, 10) : INITIAL_TRUST;
  }

  async recordSuccess(accountId: string): Promise<number> {
    const current = await this.getTrustScore(accountId);
    const next = Math.min(MAX_TRUST, current + SUCCESS_INC);
    await this.redis.set(TRUST_KEY(accountId), String(next));
    return next;
  }

  async recordFailure(
    accountId: string,
  ): Promise<{ score: number; autoPaused: boolean }> {
    const current = await this.getTrustScore(accountId);
    const next = Math.max(MIN_TRUST, current - FAILURE_DEC);
    await this.redis.set(TRUST_KEY(accountId), String(next));

    let autoPaused = false;
    if (next <= LOW_TRUST_THRESHOLD) {
      await this.setPause(accountId, AUTO_PAUSE_SECS);
      autoPaused = true;
      this.logger.warn(
        `Account ${accountId} auto-paused — trust score: ${String(next)}`,
      );
    }

    return { score: next, autoPaused };
  }

  async isPaused(accountId: string): Promise<boolean> {
    const pauseUntil = await this.redis.get(PAUSE_KEY(accountId));
    if (!pauseUntil) return false;
    return Date.now() < parseInt(pauseUntil, 10);
  }

  async setPause(accountId: string, durationSecs: number): Promise<void> {
    const pauseUntil = Date.now() + durationSecs * 1_000;
    await this.redis.setex(PAUSE_KEY(accountId), durationSecs + 60, String(pauseUntil));
    this.logger.log(`Account ${accountId} paused for ${String(durationSecs)}s`);
  }

  async clearPause(accountId: string): Promise<void> {
    await this.redis.del(PAUSE_KEY(accountId));
  }

  async initWarmup(accountId: string): Promise<void> {
    const existing = await this.redis.get(WARMUP_KEY(accountId));
    if (!existing) {
      await this.redis.set(WARMUP_KEY(accountId), String(Date.now()));
      this.logger.log(`Warmup started for account ${accountId}`);
    }
  }

  async getWarmupFactor(accountId: string): Promise<number> {
    const warmupStarted = await this.redis.get(WARMUP_KEY(accountId));
    if (!warmupStarted) return 1.0;

    const daysSince = (Date.now() - parseInt(warmupStarted, 10)) / (24 * 3_600 * 1_000);
    const entry = [...WARMUP].reverse().find((s) => daysSince >= s.days);
    return entry?.factor ?? 1.0;
  }

  async getEffectiveLimits(accountId: string, base: BaseLimits): Promise<EffectiveLimits> {
    const [warmupFactor, trustScore] = await Promise.all([
      this.getWarmupFactor(accountId),
      this.getTrustScore(accountId),
    ]);

    // Low-trust accounts get proportionally reduced limits
    const trustFactor =
      trustScore >= LOW_TRUST_THRESHOLD ? 1.0 : trustScore / LOW_TRUST_THRESHOLD;
    const factor = warmupFactor * trustFactor;

    return {
      maxMsgPerMin: Math.max(1, Math.floor(base.maxMsgPerMin * factor)),
      maxMsgPerHour: Math.max(1, Math.floor(base.maxMsgPerHour * factor)),
      maxMsgPerDay: Math.max(1, Math.floor(base.maxMsgPerDay * factor)),
      maxDmsPerHour: Math.max(1, Math.floor(base.maxDmsPerHour * factor)),
      maxCommentRepliesPerHour: Math.max(1, Math.floor(base.maxCommentRepliesPerHour * factor)),
      // Per-user and per-conversation limits are fixed — not scaled
      maxResponsesPerUser: base.maxResponsesPerUser,
      maxResponsesPerConversation: base.maxResponsesPerConversation,
      warmupActive: warmupFactor < 1.0,
      warmupFactor,
    };
  }
}
