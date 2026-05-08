import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InfrastructureException } from '@/common/exceptions/app.exception';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { PrismaService } from './prisma.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const ctx = this.tenantContext.getContext();

    if (!ctx) {
      throw new InfrastructureException('TENANT_CONTEXT_MISSING', 'No tenant context in execution scope');
    }

    if (!UUID_REGEX.test(ctx.tenantId)) {
      throw new InfrastructureException('TENANT_ID_INVALID', 'tenantId is not a valid UUID');
    }

    const { tenantId } = ctx;

    return this.prisma.$transaction(async (tx) => {
      // SET LOCAL scopes the value to this transaction only — safe with PgBouncer transaction mode
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      return fn(tx);
    });
  }
}
