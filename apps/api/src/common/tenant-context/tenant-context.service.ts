import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

@Injectable()
export class TenantContextService {
  run<T>(context: TenantContext, fn: () => T): T {
    return tenantContextStorage.run(context, fn);
  }

  getTenantId(): string | undefined {
    return tenantContextStorage.getStore()?.tenantId;
  }

  getContext(): Readonly<TenantContext> | undefined {
    return tenantContextStorage.getStore();
  }
}
