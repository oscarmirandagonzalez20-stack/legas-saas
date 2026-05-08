import { type CanActivate, type ExecutionContext, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DevTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException('DevTenantGuard must not run in production');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const raw = request.headers['x-tenant-id'];
    const tenantId = Array.isArray(raw) ? raw[0] : raw;

    if (typeof tenantId !== 'string' || !UUID_REGEX.test(tenantId)) {
      throw new UnauthorizedException('x-tenant-id header must be a valid UUID');
    }

    request.tenantId = tenantId;
    return true;
  }
}
