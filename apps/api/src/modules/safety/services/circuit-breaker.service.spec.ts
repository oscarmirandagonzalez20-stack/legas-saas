import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitState } from '../safety.types';
import { REDIS_CLIENT } from '@/redis/redis.module';

const mockRedis = {
  hgetall: vi.fn<() => Promise<Record<string, string>>>(),
  hmset: vi.fn<() => Promise<'OK'>>(),
  hset: vi.fn<() => Promise<number>>(),
  expire: vi.fn<() => Promise<number>>(),
};

const ACCOUNT = '00000000-0000-0000-0000-000000000001';
const TIMEOUT = 900_000;

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(CircuitBreakerService);
  });

  describe('getState', () => {
    it('returns default CLOSED state when no Redis data', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const state = await service.getState(ACCOUNT);

      expect(state.state).toBe(CircuitState.CLOSED);
      expect(state.failures).toBe(0);
      expect(state.checkpoint).toBe(false);
    });

    it('deserializes stored state correctly', async () => {
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.OPEN,
        failures: '5',
        lastFailureAt: '1700000000000',
        openedAt: '1700000001000',
        reason: 'rate limit',
        checkpoint: 'false',
      });

      const state = await service.getState(ACCOUNT);

      expect(state.state).toBe(CircuitState.OPEN);
      expect(state.failures).toBe(5);
      expect(state.lastFailureAt).toBe(1_700_000_000_000);
      expect(state.reason).toBe('rate limit');
    });
  });

  describe('isAllowed', () => {
    it('allows when CLOSED', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const result = await service.isAllowed(ACCOUNT, TIMEOUT);

      expect(result.allowed).toBe(true);
    });

    it('allows probe request when HALF_OPEN', async () => {
      mockRedis.hgetall.mockResolvedValue({ state: CircuitState.HALF_OPEN });

      const result = await service.isAllowed(ACCOUNT, TIMEOUT);

      expect(result.allowed).toBe(true);
    });

    it('blocks when OPEN and timeout not elapsed', async () => {
      const recentlyOpened = Date.now() - 60_000; // 1 minute ago
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.OPEN,
        failures: '3',
        openedAt: String(recentlyOpened),
        reason: 'too many errors',
        checkpoint: 'false',
      });

      const result = await service.isAllowed(ACCOUNT, TIMEOUT);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Circuit open');
    });

    it('transitions to HALF_OPEN when timeout elapsed', async () => {
      const longAgo = Date.now() - TIMEOUT - 1_000;
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.OPEN,
        failures: '3',
        openedAt: String(longAgo),
        checkpoint: 'false',
      });
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.isAllowed(ACCOUNT, TIMEOUT);

      expect(result.allowed).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining(ACCOUNT),
        'state',
        CircuitState.HALF_OPEN,
      );
    });

    it('blocks checkpoint accounts indefinitely', async () => {
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.OPEN,
        checkpoint: 'true',
        openedAt: String(Date.now() - TIMEOUT * 100), // far past timeout
      });

      const result = await service.isAllowed(ACCOUNT, TIMEOUT);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('checkpoint');
    });
  });

  describe('recordFailure', () => {
    it('opens circuit when failure count reaches threshold', async () => {
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.CLOSED,
        failures: '2',
      });
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const state = await service.recordFailure(ACCOUNT, 'test error', 3);

      expect(state).toBe(CircuitState.OPEN);
    });

    it('stays CLOSED below threshold', async () => {
      mockRedis.hgetall.mockResolvedValue({
        state: CircuitState.CLOSED,
        failures: '0',
      });
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const state = await service.recordFailure(ACCOUNT, 'test error', 3);

      expect(state).toBe(CircuitState.CLOSED);
    });

    it('immediately opens on checkpoint', async () => {
      mockRedis.hgetall.mockResolvedValue({ state: CircuitState.CLOSED, failures: '0' });
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      const state = await service.recordFailure(ACCOUNT, 'checkpoint', 3, true);

      expect(state).toBe(CircuitState.OPEN);
    });
  });

  describe('recordSuccess', () => {
    it('transitions HALF_OPEN to CLOSED', async () => {
      mockRedis.hgetall.mockResolvedValue({ state: CircuitState.HALF_OPEN, failures: '3' });
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await service.recordSuccess(ACCOUNT);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        expect.stringContaining(ACCOUNT),
        expect.objectContaining({ state: CircuitState.CLOSED, failures: '0' }),
      );
    });

    it('decrements failure count in CLOSED state', async () => {
      mockRedis.hgetall.mockResolvedValue({ state: CircuitState.CLOSED, failures: '2' });
      mockRedis.hset.mockResolvedValue(1);

      await service.recordSuccess(ACCOUNT);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringContaining(ACCOUNT),
        'failures',
        '1',
      );
    });
  });

  describe('forceClose', () => {
    it('resets all state to CLOSED', async () => {
      mockRedis.hmset.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      await service.forceClose(ACCOUNT);

      expect(mockRedis.hmset).toHaveBeenCalledWith(
        expect.stringContaining(ACCOUNT),
        expect.objectContaining({
          state: CircuitState.CLOSED,
          failures: '0',
          checkpoint: 'false',
        }),
      );
    });
  });
});
