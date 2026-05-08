import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { QueueManagementService } from './queue-management.service';

const limitSchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

@Controller('queue')
@UseGuards(DevTenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class QueueManagementController {
  constructor(private readonly queueMgmt: QueueManagementService) {}

  @Get('stats')
  stats() {
    return this.queueMgmt.getStats();
  }

  @Get('failed')
  failed(@Query(new ZodValidationPipe(limitSchema)) query: { limit: number }) {
    return this.queueMgmt.getFailedJobs(query.limit);
  }

  // Strict limit on retry to prevent accidental queue floods from the UI
  @Post('failed/:id/retry')
  @HttpCode(200)
  @Throttle({ strict: { ttl: 60_000, limit: 20 } })
  retry(@Param('id') id: string) {
    return this.queueMgmt.retryJob(id);
  }
}
