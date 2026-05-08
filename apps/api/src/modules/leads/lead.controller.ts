import { Body, Controller, Get, HttpCode, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { createLeadSchema, type CreateLeadDto } from './dto/create-lead.dto';
import { listLeadsSchema, type ListLeadsDto } from './dto/list-leads.dto';
import { LeadService } from './lead.service';

@Controller('leads')
@UseGuards(DevTenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listLeadsSchema)) query: ListLeadsDto) {
    return this.leadService.list(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(createLeadSchema)) dto: CreateLeadDto) {
    return this.leadService.create(dto);
  }
}
