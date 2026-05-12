import { describe, it, expect } from 'vitest';
import { HumanizationService } from './humanization.service';

describe('HumanizationService', () => {
  const service = new HumanizationService();
  const config = { minDelayMs: 20_000, maxDelayMs: 180_000 };

  it('returns delay within configured range', () => {
    for (let i = 0; i < 50; i++) {
      const delay = service.getDelay(config);
      expect(delay).toBeGreaterThanOrEqual(config.minDelayMs);
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
    }
  });

  it('returns different values across calls (not a fixed number)', () => {
    const delays = new Set(Array.from({ length: 20 }, () => service.getDelay(config)));
    expect(delays.size).toBeGreaterThan(1);
  });

  it('detects instant response (< 5s)', () => {
    const now = Date.now();
    expect(service.isInstantResponse(now - 4_999)).toBe(true);
    expect(service.isInstantResponse(now - 5_001)).toBe(false);
  });
});
