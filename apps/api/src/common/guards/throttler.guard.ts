import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Fastify exposes IP on request.ip; override the default Express-based extraction.
@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: FastifyRequest): Promise<string> {
    // Prefer the real client IP from the proxy header when present
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      if (first) return Promise.resolve(first.trim());
    }
    return Promise.resolve(req.ip);
  }

  protected override getRequestResponse(context: ExecutionContext): { req: FastifyRequest; res: FastifyReply } {
    const http = context.switchToHttp();
    return { req: http.getRequest<FastifyRequest>(), res: http.getResponse<FastifyReply>() };
  }
}
