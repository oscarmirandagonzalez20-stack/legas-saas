import { describe, expect, it } from 'vitest';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const svc = new TenantContextService();
  const tenantId = 'a1b2c3d4-0000-0000-0000-000000000001';

  describe('outside any context', () => {
    it('getTenantId returns undefined', () => {
      expect(svc.getTenantId()).toBeUndefined();
    });

    it('getContext returns undefined', () => {
      expect(svc.getContext()).toBeUndefined();
    });
  });

  describe('inside run()', () => {
    it('getTenantId returns the tenantId', () => {
      svc.run({ tenantId }, () => {
        expect(svc.getTenantId()).toBe(tenantId);
      });
    });

    it('getContext returns the full context object', () => {
      svc.run({ tenantId }, () => {
        expect(svc.getContext()).toEqual({ tenantId });
      });
    });

    it('getContext returns a reference equal to the object passed to run()', () => {
      const ctx = { tenantId };
      svc.run(ctx, () => {
        expect(svc.getContext()).toBe(ctx);
      });
    });
  });

  describe('async propagation — context survives async hops', () => {
    it('preserves context across sequential awaits', async () => {
      const steps: (string | undefined)[] = [];

      await svc.run({ tenantId }, async () => {
        steps.push(svc.getTenantId()); // sync

        await Promise.resolve();
        steps.push(svc.getTenantId()); // after microtask

        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        steps.push(svc.getTenantId()); // after macrotask (setTimeout)

        await Promise.resolve();
        await Promise.resolve();
        steps.push(svc.getTenantId()); // after multiple microtasks
      });

      expect(steps).toEqual([tenantId, tenantId, tenantId, tenantId]);
    });

    it('preserves context across Promise.all', async () => {
      const results: (string | undefined)[] = [];

      await svc.run({ tenantId }, async () => {
        await Promise.all([
          Promise.resolve().then(() => results.push(svc.getTenantId())),
          Promise.resolve().then(() => results.push(svc.getTenantId())),
          Promise.resolve().then(() => results.push(svc.getTenantId())),
        ]);
      });

      expect(results).toEqual([tenantId, tenantId, tenantId]);
    });

    it('isolates context between two concurrent run() calls', async () => {
      const idA = 'aaaaaaaa-0000-0000-0000-000000000001';
      const idB = 'bbbbbbbb-0000-0000-0000-000000000002';
      const capturedA: (string | undefined)[] = [];
      const capturedB: (string | undefined)[] = [];

      await Promise.all([
        svc.run({ tenantId: idA }, async () => {
          await Promise.resolve();
          capturedA.push(svc.getTenantId());
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          capturedA.push(svc.getTenantId());
        }),
        svc.run({ tenantId: idB }, async () => {
          await Promise.resolve();
          capturedB.push(svc.getTenantId());
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          capturedB.push(svc.getTenantId());
        }),
      ]);

      expect(capturedA).toEqual([idA, idA]);
      expect(capturedB).toEqual([idB, idB]);
    });

    it('isolates context among five concurrent run() calls', async () => {
      const ids = Array.from({ length: 5 }, (_, i) => `tenant-${String(i).padStart(8, '0')}`);
      const captured: Record<string, string[]> = {};

      await Promise.all(
        ids.map((id) =>
          svc.run({ tenantId: id }, async () => {
            captured[id] = [];
            await Promise.resolve();
            captured[id].push(svc.getTenantId() ?? 'undefined');
            await new Promise<void>((resolve) => setTimeout(resolve, 5));
            captured[id].push(svc.getTenantId() ?? 'undefined');
          }),
        ),
      );

      for (const id of ids) {
        expect(captured[id]).toEqual([id, id]);
      }
    });
  });

  describe('context cleanup after run()', () => {
    it('getTenantId returns undefined after run() resolves (async)', async () => {
      await svc.run({ tenantId }, async () => {
        await Promise.resolve();
        expect(svc.getTenantId()).toBe(tenantId);
      });

      expect(svc.getTenantId()).toBeUndefined();
    });

    it('getContext returns undefined after run() resolves (async)', async () => {
      await svc.run({ tenantId }, async () => {
        await Promise.resolve();
        expect(svc.getContext()).toEqual({ tenantId });
      });

      expect(svc.getContext()).toBeUndefined();
    });

    it('does not leak context after run() completes (sync)', () => {
      svc.run({ tenantId }, () => {
        expect(svc.getTenantId()).toBe(tenantId);
      });

      expect(svc.getTenantId()).toBeUndefined();
    });

    it('nested run() restores outer context on exit', () => {
      const outer = 'outer-tenant-0000-0000-0000-000000000001';
      const inner = 'inner-tenant-0000-0000-0000-000000000002';

      svc.run({ tenantId: outer }, () => {
        expect(svc.getTenantId()).toBe(outer);

        svc.run({ tenantId: inner }, () => {
          expect(svc.getTenantId()).toBe(inner);
        });

        expect(svc.getTenantId()).toBe(outer);
      });

      expect(svc.getTenantId()).toBeUndefined();
    });
  });
});
