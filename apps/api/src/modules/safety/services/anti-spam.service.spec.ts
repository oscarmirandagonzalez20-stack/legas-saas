import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AntiSpamService } from './anti-spam.service';
import { REDIS_CLIENT } from '@/redis/redis.module';

const mockRedis = {
  exists: vi.fn<() => Promise<number>>(),
  setex: vi.fn<() => Promise<'OK'>>(),
  get: vi.fn<() => Promise<string | null>>(),
  incr: vi.fn<() => Promise<number>>(),
  expire: vi.fn<() => Promise<number>>(),
};

const ACCOUNT = 'acc-001';
const CONV = '00000000-0000-0000-0000-000000000001';

describe('AntiSpamService', () => {
  let service: AntiSpamService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AntiSpamService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(AntiSpamService);
  });

  describe('isDuplicateMessage', () => {
    it('returns false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await service.isDuplicateMessage(ACCOUNT, CONV, 'Hello there');
      expect(result).toBe(false);
    });

    it('returns true when key exists (duplicate)', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await service.isDuplicateMessage(ACCOUNT, CONV, 'Hello there');
      expect(result).toBe(true);
    });

    it('treats same content with different whitespace as duplicate', () => {
      const hash1 = service.contentHash('Hello  there');
      const hash2 = service.contentHash('Hello there');
      expect(hash1).toBe(hash2);
    });

    it('treats same content with different punctuation as duplicate', () => {
      const hash1 = service.contentHash('Hola, ¿cómo está?');
      const hash2 = service.contentHash('Hola cómo está');
      expect(hash1).toBe(hash2);
    });

    it('treats different content as different', () => {
      const hash1 = service.contentHash('Hello there');
      const hash2 = service.contentHash('Goodbye friend');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('recordSentMessage', () => {
    it('sets key with 24h TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.recordSentMessage(ACCOUNT, CONV, 'Hello');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('safety:spam'),
        86_400,
        '1',
      );
    });
  });

  describe('isTemplateOverused', () => {
    it('returns false when template used < limit', async () => {
      mockRedis.get.mockResolvedValue('2');
      const result = await service.isTemplateOverused(ACCOUNT, 'tpl-001');
      expect(result).toBe(false);
    });

    it('returns true when template used >= limit', async () => {
      mockRedis.get.mockResolvedValue('3');
      const result = await service.isTemplateOverused(ACCOUNT, 'tpl-001');
      expect(result).toBe(true);
    });

    it('returns false when no usage record exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.isTemplateOverused(ACCOUNT, 'tpl-001');
      expect(result).toBe(false);
    });
  });
});
