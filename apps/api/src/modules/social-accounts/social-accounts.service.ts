import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { META_GRAPH_BASE_URL, unsubscribeWebhook } from '@legal-saas/meta-sdk';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import { CryptoService } from '@/common/crypto/crypto.service';
import type { SocialAccountDto } from './dto/social-account.dto';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async listAccounts(): Promise<SocialAccountDto[]> {
    return this.prisma.run(async (tx) => {
      return tx.socialAccount.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          platform: true,
          externalId: true,
          displayName: true,
          status: true,
          webhookSubscribedAt: true,
          webhookSubscriptionError: true,
          tokenExpiresAt: true,
          createdAt: true,
          updatedAt: true,
          // accessTokenEncrypted is intentionally excluded — never exposed via API
        },
      });
    });
  }

  async disconnect(id: string): Promise<void> {
    const account = await this.prisma.run(async (tx) => {
      return tx.socialAccount.findUnique({
        where: { id },
        select: {
          id: true,
          externalId: true,
          platform: true,
          accessTokenEncrypted: true,
        },
      });
    });

    if (!account) {
      throw new NotFoundException(`Social account not found`);
    }

    // Best-effort webhook unsubscription for FB pages (before marking REVOKED)
    if (account.platform === 'FACEBOOK') {
      try {
        const pageToken = this.crypto.decrypt(account.accessTokenEncrypted);
        await unsubscribeWebhook(META_GRAPH_BASE_URL, account.externalId, pageToken);
        this.logger.debug({ accountId: id }, 'Webhook unsubscribed');
      } catch (err) {
        // Non-fatal: proceed with disconnect regardless
        this.logger.warn(
          { accountId: id, error: err instanceof Error ? err.message : 'unknown' },
          'Webhook unsubscription failed — proceeding with disconnect anyway',
        );
      }
    }

    await this.prisma.run(async (tx) => {
      await tx.socialAccount.update({
        where: { id },
        data: { status: 'REVOKED', webhookSubscribedAt: null },
      });
    });
  }

  async getReconnectUrl(
    id: string,
    buildConnectUrl: (tenantId: string) => Promise<string>,
    tenantId: string,
  ): Promise<string> {
    // Verify the account exists and belongs to the current tenant (RLS enforces this)
    await this.prisma.run(async (tx) => {
      await tx.socialAccount.findUniqueOrThrow({ where: { id }, select: { id: true } });
    });
    return buildConnectUrl(tenantId);
  }
}
