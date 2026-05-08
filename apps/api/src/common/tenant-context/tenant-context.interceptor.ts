import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { tenantId } = request;

    if (tenantId === undefined) {
      throw new UnauthorizedException('Tenant context not established');
    }

    return new Observable<unknown>((observer) => {
      this.tenantContext.run({ tenantId }, () => {
        next.handle().subscribe(observer);
      });
    });
  }
}
