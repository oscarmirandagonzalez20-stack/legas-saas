import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { MetaRateLimiterService } from './meta-rate-limiter.service';
import { REDIS_CLIENT } from '@/redis/redis.module';

const mockRedis = {
  incr: vi.fn<() => Promise<number>>(),
  expire: vi.fn<() => Promise<number>>(),
  get: vi.fn<() => Promise<string | null>>(),
};

describe('MetaRateLimiterService', () => {
  let service: MetaRateLimiterService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MetaRateLimiterService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(MetaRateLimiterService);
  });

  describe('checkAndIncrement', () => {
    it('allows request when below limit', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.checkAndIncrement('test:key', 60, 5);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(mockRedis.incr).toHaveBeenCalledOnce();
      expect(mockRedis.expire).toHaveBeenCalledOnce(); // TTL set on first entry
    });

    it('blocks request when at limit', async () => {
      mockRedis.incr.mockResolvedValue(6);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.checkAndIncrement('test:key', 60, 5);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('does not reset TTL on subsequent calls in same bucket', async () => {
      mockRedis.incr.mockResolvedValue(3); // count > 1 → no expire call
      mockRedis.expire.mockResolvedValue(1);

      await service.checkAndIncrement('test:key', 60, 5);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('returns correct resetAt for current bucket', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const before = Date.now();
      const result = await service.checkAndIncrement('test:key', 60, 5);
      const windowSecs = 60;
      const bucket = Math.floor(before / (windowSecs * 1_000));
      const expectedResetAt = (bucket + 1) * windowSecs * 1_000;

      expect(result.resetAt).toBeGreaterThanOrEqual(expectedResetAt - 100);
    });
  });

  describe('checkAccountMsgPerMin', () => {
    it('uses msg:min key suffix', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.checkAccountMsgPerMin('acc-1', 2);

      expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('acct:acc-1:msg:min'));
    });
  });

  describe('checkResponsesPerUser', () => {
    it('scopes key to account + recipient', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.checkResponsesPerUser('acc-1', 'user-42', 3);

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/acc-1.*user-42|user-42.*acc-1/),
      );
    });
  });

  describe('checkResponsesPerConversation', () => {
    it('scopes key to conversation id', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const convId = '123e4567-e89b-12d3-a456-426614174000';
      await service.checkResponsesPerConversation(convId, 5);

      expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining(convId));
    });
  });
});
