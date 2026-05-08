import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AppConfigService } from '@/config/app-config.service';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { metaCallbackSchema, type MetaCallbackDto } from './dto/meta-callback.dto';
import { MetaOAuthService } from './meta-oauth.service';

@Controller('social-accounts/meta')
export class MetaOAuthController {
  private readonly logger = new Logger(MetaOAuthController.name);

  constructor(
    private readonly metaOAuthService: MetaOAuthService,
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfigService,
  ) {}

  // ── GET /social-accounts/meta/connect ────────────────────────────────────────
  // Requires tenant context established by DevTenantGuard (dev) / Clerk guard (prod).
  // Returns the Facebook OAuth dialog URL — client performs the redirect.

  @Get('connect')
  @UseGuards(DevTenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  @HttpCode(200)
  async connect(@Query('returnUrl') returnUrl?: string): Promise<{ url: string }> {
    const tenantId = this.tenantContext.getTenantId() ?? '';
    const url = await this.metaOAuthService.buildConnectUrl(tenantId, returnUrl);
    return { url };
  }

  // ── GET /social-accounts/meta/callback ───────────────────────────────────────
  // Meta redirects the user's browser here after OAuth dialog.
  // NO auth guard — tenantId is resolved from the Redis state nonce.
  // Installs ALS tenant context manually, then delegates to service (RLS active).

  @Get('callback')
  async callback(
    @Query(new ZodValidationPipe(metaCallbackSchema)) query: MetaCallbackDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Handle OAuth denial / error from Meta
    if (query.error !== undefined || !query.code || !query.state) {
      const errorParam = query.error ?? 'missing_params';
      const redirectUrl = new URL('/settings/social-accounts', this.config.frontendUrl);
      redirectUrl.searchParams.set('error', errorParam);
      await reply.redirect(redirectUrl.toString());
      return;
    }

    const { code, state: stateParam } = query as { code: string; state: string };

    // Validate + consume state (single-use via Redis GETDEL)
    const oauthState = await this.metaOAuthService.validateAndConsumeState(stateParam);

    // Install ALS tenant context — same boundary pattern as webhook workers
    const result = await this.tenantContext.run(
      { tenantId: oauthState.tenantId },
      () => this.metaOAuthService.processCallback(code, oauthState),
    );

    this.logger.log(
      { tenantId: oauthState.tenantId, accountsConnected: result.accountsConnected },
      'OAuth callback completed',
    );

    const defaultRedirect = new URL('/settings/social-accounts', this.config.frontendUrl);
    defaultRedirect.searchParams.set('connected', String(result.accountsConnected));

    await reply.redirect(oauthState.returnUrl ?? defaultRedirect.toString());
  }
}
