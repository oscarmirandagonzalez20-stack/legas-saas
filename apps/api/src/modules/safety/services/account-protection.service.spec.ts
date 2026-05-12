import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AccountProtectionService } from './account-protection.service';
import { REDIS_CLIENT } from '@/redis/redis.module';

const mockRedis = {
  get: vi.fn<() => Promise<string | null>>(),
  set: vi.fn<() => Promise<'OK'>>(),
  setex: vi.fn<() => Promise<'OK'>>(),
  del: vi.fn<() => Promise<number>>(),
};

const ACCOUNT = '00000000-0000-0000-0000-000000000001';

const base = {
  maxMsgPerMin: 2,
  maxMsgPerHour: 30,
  maxMsgPerDay: 200,
  maxDmsPerHour: 20,
  maxCommentRepliesPerHour: 30,
  maxResponsesPerUser: 3,
  maxResponsesPerConversation: 5,
};

describe('AccountProtectionService', () => {
  let service: AccountProtectionService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AccountProtectionService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(AccountProtectionService);
  });

  describe('getTrustScore', () => {
    it('returns 50 for new account (no Redis entry)', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.getTrustScore(ACCOUNT)).toBe(50);
    });

    it('returns stored score', async () => {
      mockRedis.get.mockResolvedValue('75');
      expect(await service.getTrustScore(ACCOUNT)).toBe(75);
    });
  });

  describe('recordSuccess', () => {
    it('increments trust score by 1', async () => {
      mockRedis.get.mockResolvedValue('80');
      mockRedis.set.mockResolvedValue('OK');

      const score = await service.recordSuccess(ACCOUNT);
      expect(score).toBe(81);
      expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), '81');
    });

    it('caps trust score at 100', async () => {
      mockRedis.get.mockResolvedValue('100');
      mockRedis.set.mockResolvedValue('OK');

      const score = await service.recordSuccess(ACCOUNT);
      expect(score).toBe(100);
    });
  });

  describe('recordFailure', () => {
    it('decrements trust score by 10', async () => {
      mockRedis.get.mockResolvedValue('50');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.setex.mockResolvedValue('OK');

      const { score } = await service.recordFailure(ACCOUNT);
      expect(score).toBe(40);
    });

    it('auto-pauses when score drops to low threshold', async () => {
      mockRedis.get.mockResolvedValue('25');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.setex.mockResolvedValue('OK');

      const { autoPaused } = await service.recordFailure(ACCOUNT);
      expect(autoPaused).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('floors trust score at 0', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.setex.mockResolvedValue('OK');

      const { score } = await service.recordFailure(ACCOUNT);
      expect(score).toBe(0);
    });
  });

  describe('isPaused', () => {
    it('returns false when not paused', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.isPaused(ACCOUNT)).toBe(false);
    });

    it('returns true when pause is in the future', async () => {
      mockRedis.get.mockResolvedValue(String(Date.now() + 3_600_000));
      expect(await service.isPaused(ACCOUNT)).toBe(true);
    });

    it('returns false when pause has expired', async () => {
      mockRedis.get.mockResolvedValue(String(Date.now() - 1_000));
      expect(await service.isPaused(ACCOUNT)).toBe(false);
    });
  });

  describe('getEffectiveLimits', () => {
    it('returns full limits for account without warmup (factor 1.0)', async () => {
      // No warmup key, trust 50 → factor = 1.0
      mockRedis.get
        .mockResolvedValueOnce(null) // warmup key
        .mockResolvedValueOnce('50'); // trust score

      const limits = await service.getEffectiveLimits(ACCOUNT, base);

      expect(limits.maxMsgPerMin).toBe(2);
      expect(limits.maxMsgPerHour).toBe(30);
      expect(limits.warmupActive).toBe(false);
    });

    it('applies warmup 10% factor on day 0', async () => {
      const warmupStart = String(Date.now()); // started now → day 0 → 10%
      mockRedis.get
        .mockResolvedValueOnce(warmupStart)
        .mockResolvedValueOnce('50');

      const limits = await service.getEffectiveLimits(ACCOUNT, base);

      expect(limits.maxMsgPerMin).toBe(1); // max(1, floor(2 * 0.10))
      expect(limits.warmupActive).toBe(true);
      expect(limits.warmupFactor).toBe(0.1);
    });

    it('per-user and per-conversation limits are not scaled', async () => {
      const warmupStart = String(Date.now()); // 10% factor
      mockRedis.get
        .mockResolvedValueOnce(warmupStart)
        .mockResolvedValueOnce('50');

      const limits = await service.getEffectiveLimits(ACCOUNT, base);

      expect(limits.maxResponsesPerUser).toBe(3); // fixed
      expect(limits.maxResponsesPerConversation).toBe(5); // fixed
    });
  });
});
