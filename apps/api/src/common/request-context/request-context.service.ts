import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextService {
  run<T>(context: RequestContext, fn: () => T): T {
    return requestContextStorage.run(context, fn);
  }

  getRequestId(): string | undefined {
    return requestContextStorage.getStore()?.requestId;
  }
}
