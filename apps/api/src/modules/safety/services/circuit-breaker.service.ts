import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.module';
import { CircuitState } from '../safety.types';
import type { CircuitBreakerState } from '../safety.types';

const CB_KEY = (accountId: string): string => `safety:cb:${accountId}`;
const CB_TTL_SECS = 7 * 24 * 3_600; // 7 days — auto-expire stale breakers

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getState(accountId: string): Promise<CircuitBreakerState> {
    const data = await this.redis.hgetall(CB_KEY(accountId));

    if (Object.keys(data).length === 0) {
      return this.defaultState();
    }

    return {
      state: (data.state as CircuitState | undefined) ?? CircuitState.CLOSED,
      failures: parseInt(data.failures ?? '0', 10),
      lastFailureAt: data.lastFailureAt ? parseInt(data.lastFailureAt, 10) : null,
      openedAt: data.openedAt ? parseInt(data.openedAt, 10) : null,
      reason: data.reason ?? null,
      checkpoint: data.checkpoint === 'true',
    };
  }

  async isAllowed(
    accountId: string,
    timeoutMs: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const state = await this.getState(accountId);

    if (state.state === CircuitState.CLOSED) {
      return { allowed: true };
    }

    if (state.state === CircuitState.HALF_OPEN) {
      return { allowed: true }; // Probe request — caller must report outcome
    }

    // OPEN state
    if (state.checkpoint) {
      return {
        allowed: false,
        reason: 'Meta checkpoint detected — manual reset required via admin panel',
      };
    }

    const elapsed = state.openedAt !== null ? Date.now() - state.openedAt : Infinity;
    if (elapsed >= timeoutMs) {
      await this.transitionTo(accountId, CircuitState.HALF_OPEN);
      this.logger.log(`Circuit ${accountId}: OPEN → HALF_OPEN (timeout elapsed)`);
      return { allowed: true };
    }

    const remainingSecs = Math.ceil((timeoutMs - elapsed) / 1_000);
    return {
      allowed: false,
      reason: `Circuit open — auto-reset in ${String(remainingSecs)}s (${state.reason ?? 'unknown'})`,
    };
  }

  async recordSuccess(accountId: string): Promise<void> {
    const state = await this.getState(accountId);

    if (state.state === CircuitState.HALF_OPEN) {
      await this.redis.hmset(CB_KEY(accountId), {
        state: CircuitState.CLOSED,
        failures: '0',
        openedAt: '',
        reason: '',
        checkpoint: 'false',
      });
      await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);
      this.logger.log(`Circuit ${accountId}: HALF_OPEN → CLOSED (recovery confirmed)`);
      return;
    }

    // Gradually heal failure count in CLOSED state
    if (state.state === CircuitState.CLOSED && state.failures > 0) {
      await this.redis.hset(CB_KEY(accountId), 'failures', String(Math.max(0, state.failures - 1)));
    }
  }

  async recordFailure(
    accountId: string,
    reason: string,
    threshold: number,
    isCheckpoint = false,
  ): Promise<CircuitState> {
    const state = await this.getState(accountId);
    const newFailures = state.failures + 1;
    const now = Date.now();

    await this.redis.hmset(CB_KEY(accountId), {
      failures: String(newFailures),
      lastFailureAt: String(now),
    });
    await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);

    if (isCheckpoint) {
      await this.redis.hmset(CB_KEY(accountId), {
        state: CircuitState.OPEN,
        openedAt: String(now),
        reason: 'Meta checkpoint detected',
        checkpoint: 'true',
      });
      this.logger.error(`Circuit ${accountId}: OPEN (checkpoint — requires manual reset)`);
      return CircuitState.OPEN;
    }

    const shouldOpen =
      state.state === CircuitState.HALF_OPEN || newFailures >= threshold;

    if (shouldOpen) {
      await this.redis.hmset(CB_KEY(accountId), {
        state: CircuitState.OPEN,
        openedAt: String(now),
        reason,
      });
      await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);
      this.logger.warn(
        `Circuit ${accountId}: → OPEN (${String(newFailures)} failures, reason: ${reason})`,
      );
      return CircuitState.OPEN;
    }

    this.logger.warn(
      `Circuit ${accountId}: failure ${String(newFailures)}/${String(threshold)} — ${reason}`,
    );
    return state.state;
  }

  async forceOpen(accountId: string, reason: string): Promise<void> {
    await this.redis.hmset(CB_KEY(accountId), {
      state: CircuitState.OPEN,
      openedAt: String(Date.now()),
      reason,
      checkpoint: 'false',
    });
    await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);
    this.logger.warn(`Circuit ${accountId}: force-opened (${reason})`);
  }

  async forceClose(accountId: string): Promise<void> {
    await this.redis.hmset(CB_KEY(accountId), {
      state: CircuitState.CLOSED,
      failures: '0',
      openedAt: '',
      reason: '',
      checkpoint: 'false',
    });
    await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);
    this.logger.log(`Circuit ${accountId}: force-closed`);
  }

  private async transitionTo(accountId: string, newState: CircuitState): Promise<void> {
    await this.redis.hset(CB_KEY(accountId), 'state', newState);
    await this.redis.expire(CB_KEY(accountId), CB_TTL_SECS);
  }

  private defaultState(): CircuitBreakerState {
    return {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailureAt: null,
      openedAt: null,
      reason: null,
      checkpoint: false,
    };
  }
}
