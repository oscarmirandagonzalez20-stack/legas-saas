import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { MetaOAuthService } from '../meta-oauth/meta-oauth.service';
import type { SocialAccountDto } from './dto/social-account.dto';
import { SocialAccountsService } from './social-accounts.service';

@Controller('social-accounts')
@UseGuards(DevTenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class SocialAccountsController {
  constructor(
    private readonly socialAccountsService: SocialAccountsService,
    private readonly metaOAuthService: MetaOAuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  async listAccounts(): Promise<SocialAccountDto[]> {
    return this.socialAccountsService.listAccounts();
  }

  @Delete(':id')
  @HttpCode(204)
  async disconnect(@Param('id') id: string): Promise<void> {
    return this.socialAccountsService.disconnect(id);
  }

  @Post(':id/reconnect')
  async reconnect(
    @Param('id') id: string,
    @Query('returnUrl') returnUrl?: string,
  ): Promise<{ url: string }> {
    const tenantId = this.tenantContext.getTenantId() ?? '';
    const url = await this.socialAccountsService.getReconnectUrl(
      id,
      (tid) => this.metaOAuthService.buildConnectUrl(tid, returnUrl),
      tenantId,
    );
    return { url };
  }
}
