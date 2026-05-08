import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Observable } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContextService } from './tenant-context.service';

const svc = new TenantContextService();
const interceptor = new TenantContextInterceptor(svc);
const TENANT_ID = 'a1b2c3d4-1234-4abc-89ef-000000000001';

function makeContext(tenantId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ tenantId }) }),
  } as unknown as ExecutionContext;
}

function makeHandler(onHandle?: () => void): CallHandler {
  return {
    handle: () =>
      new Observable((obs) => {
        onHandle?.();
        obs.next({});
        obs.complete();
      }),
  };
}

function subscribe(observable: Observable<unknown>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    observable.subscribe({ complete: resolve, error: reject });
  });
}

describe('TenantContextInterceptor', () => {
  describe('missing tenantId', () => {
    it('throws UnauthorizedException synchronously when request.tenantId is undefined', () => {
      expect(() => interceptor.intercept(makeContext(undefined), makeHandler())).toThrow(UnauthorizedException);
    });
  });

  describe('ALS propagation', () => {
    it('makes tenantId available via ALS inside a synchronous handler', async () => {
      let captured: string | undefined;
      await subscribe(interceptor.intercept(makeContext(TENANT_ID), makeHandler(() => { captured = svc.getTenantId(); })));
      expect(captured).toBe(TENANT_ID);
    });

    it('clears tenantId from ALS after the observable completes', async () => {
      await subscribe(interceptor.intercept(makeContext(TENANT_ID), makeHandler()));
      expect(svc.getTenantId()).toBeUndefined();
    });

    it('propagates tenantId through async hops inside the handler', async () => {
      const steps: (string | undefined)[] = [];

      const handler: CallHandler = {
        handle: () =>
          new Observable((obs) => {
            void (async (): Promise<void> => {
              steps.push(svc.getTenantId()); // sync
              await Promise.resolve();
              steps.push(svc.getTenantId()); // after microtask
              await new Promise<void>((r) => setTimeout(r, 0));
              steps.push(svc.getTenantId()); // after macrotask
              obs.next({});
              obs.complete();
            })().catch((err: unknown) => { obs.error(err); });
          }),
      };

      await subscribe(interceptor.intercept(makeContext(TENANT_ID), handler));

      expect(steps).toEqual([TENANT_ID, TENANT_ID, TENANT_ID]);
    });
  });

  describe('concurrent isolation', () => {
    it('isolates tenantId between two concurrent interceptor invocations', async () => {
      const idA = 'aaaaaaaa-0000-0000-0000-000000000001';
      const idB = 'bbbbbbbb-0000-0000-0000-000000000002';
      const capturedA: (string | undefined)[] = [];
      const capturedB: (string | undefined)[] = [];

      const makeAsyncHandler = (captured: (string | undefined)[]): CallHandler => ({
        handle: () =>
          new Observable((obs) => {
            void (async (): Promise<void> => {
              await Promise.resolve();
              captured.push(svc.getTenantId());
              await new Promise<void>((r) => setTimeout(r, 5));
              captured.push(svc.getTenantId());
              obs.next({});
              obs.complete();
            })().catch((err: unknown) => { obs.error(err); });
          }),
      });

      await Promise.all([
        subscribe(interceptor.intercept(makeContext(idA), makeAsyncHandler(capturedA))),
        subscribe(interceptor.intercept(makeContext(idB), makeAsyncHandler(capturedB))),
      ]);

      expect(capturedA).toEqual([idA, idA]);
      expect(capturedB).toEqual([idB, idB]);
    });
  });
});
