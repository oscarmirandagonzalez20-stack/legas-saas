import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

@Global()
@Module({
  providers: [PrismaService, TenantPrismaService],
  // PrismaService exported for infrastructure use only (health checks, migrations)
  // Business modules must use TenantPrismaService exclusively
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}
