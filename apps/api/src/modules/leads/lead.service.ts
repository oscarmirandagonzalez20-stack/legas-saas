import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InfrastructureException } from '@/common/exceptions/app.exception';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { LeadListResponse, LeadRow, ListLeadsDto } from './dto/list-leads.dto';

const LEAD_SELECT = {
  id: true,
  externalUserId: true,
  displayName: true,
  areaLegal: true,
  stage: true,
  stageChangedAt: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.LeadSelect;

@Injectable()
export class LeadService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(dto: ListLeadsDto): Promise<LeadListResponse> {
    const { search, stage, page, limit } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {};
    if (stage) where.stage = stage;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { externalUserId: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.tenantPrisma.run(async (tx) => {
      const [data, total] = await Promise.all([
        tx.lead.findMany({
          select: LEAD_SELECT,
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        tx.lead.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    });
  }

  async create(dto: CreateLeadDto): Promise<LeadRow> {
    const ctx = this.tenantContext.getContext();
    if (!ctx) {
      throw new InfrastructureException('TENANT_CONTEXT_MISSING', 'No tenant context for lead creation');
    }
    const { tenantId } = ctx;
    return this.tenantPrisma.run((tx) =>
      tx.lead.create({
        select: LEAD_SELECT,
        data: {
          tenantId,
          externalUserId: dto.externalUserId,
          displayName: dto.displayName,
          areaLegal: dto.areaLegal,
          whatsappPhone: dto.whatsappPhone,
          email: dto.email,
          tags: [],
        },
      }),
    );
  }
}
