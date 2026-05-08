import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { RequestContextService } from '@/common/request-context/request-context.service';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const rawId = request.id;
    const requestId = typeof rawId === 'string' ? rawId : String(rawId);
    reply.header('x-request-id', requestId);

    return new Observable<unknown>((observer) => {
      this.requestContext.run({ requestId }, () => {
        next.handle().subscribe(observer);
      });
    });
  }
}
