import { describe, expect, it } from 'vitest';
import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  const svc = new RequestContextService();
  const id = 'test-request-id-abc123';

  describe('getRequestId', () => {
    it('returns undefined outside a context', () => {
      expect(svc.getRequestId()).toBeUndefined();
    });

    it('returns the requestId inside run()', () => {
      svc.run({ requestId: id }, () => {
        expect(svc.getRequestId()).toBe(id);
      });
    });
  });

  describe('async propagation — context survives async hops', () => {
    it('preserves context across sequential awaits', async () => {
      const steps: (string | undefined)[] = [];

      await svc.run({ requestId: id }, async () => {
        steps.push(svc.getRequestId()); // sync

        await Promise.resolve();
        steps.push(svc.getRequestId()); // after microtask

        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        steps.push(svc.getRequestId()); // after macrotask (setTimeout)

        await Promise.resolve();
        await Promise.resolve();
        steps.push(svc.getRequestId()); // after multiple microtasks
      });

      expect(steps).toEqual([id, id, id, id]);
    });

    it('preserves context across Promise.all', async () => {
      const results: (string | undefined)[] = [];

      await svc.run({ requestId: id }, async () => {
        await Promise.all([
          Promise.resolve().then(() => results.push(svc.getRequestId())),
          Promise.resolve().then(() => results.push(svc.getRequestId())),
          Promise.resolve().then(() => results.push(svc.getRequestId())),
        ]);
      });

      expect(results).toEqual([id, id, id]);
    });

    it('isolates context between concurrent run() calls', async () => {
      const idA = 'request-A';
      const idB = 'request-B';
      const capturedA: (string | undefined)[] = [];
      const capturedB: (string | undefined)[] = [];

      await Promise.all([
        svc.run({ requestId: idA }, async () => {
          await Promise.resolve();
          capturedA.push(svc.getRequestId());
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          capturedA.push(svc.getRequestId());
        }),
        svc.run({ requestId: idB }, async () => {
          await Promise.resolve();
          capturedB.push(svc.getRequestId());
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          capturedB.push(svc.getRequestId());
        }),
      ]);

      expect(capturedA).toEqual([idA, idA]);
      expect(capturedB).toEqual([idB, idB]);
    });

    it('does not leak context outside the run() scope', async () => {
      await svc.run({ requestId: id }, async () => {
        await Promise.resolve();
        expect(svc.getRequestId()).toBe(id);
      });
      // After run() resolves, the context is gone
      expect(svc.getRequestId()).toBeUndefined();
    });
  });
});
