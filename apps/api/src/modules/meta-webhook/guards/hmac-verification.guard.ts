import { createHmac, timingSafeEqual } from 'crypto';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { Env } from '@/config/env.validation';

@Injectable()
export class HmacVerificationGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawBody = request.rawBody;

    if (!rawBody) {
      throw new ForbiddenException('Missing raw body for HMAC verification');
    }

    const signature = request.headers['x-hub-signature-256'];
    if (typeof signature !== 'string' || !signature.startsWith('sha256=')) {
      throw new ForbiddenException('Missing or malformed X-Hub-Signature-256');
    }

    const appSecret = this.config.get('META_APP_SECRET', { infer: true });
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new ForbiddenException('HMAC signature mismatch');
    }

    return true;
  }
}
