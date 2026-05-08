import { randomUUID, timingSafeEqual } from 'crypto';
import { ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  META_GRAPH_BASE_URL,
  buildAuthUrl,
  exchangeCodeForToken,
  getInstagramAccount,
  getLongLivedToken,
  getPages,
  subscribeWebhook,
  type MetaPage,
} from '@legal-saas/meta-sdk';
import { REDIS_CLIENT } from '@/redis/redis.module';
import { AppConfigService } from '@/config/app-config.service';
import { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import { CryptoService } from '@/common/crypto/crypto.service';
import {
  OAUTH_STATE_KEY_PREFIX,
  OAUTH_STATE_TTL_SECONDS,
  oauthStateSchema,
  type OAuthState,
} from './dto/meta-callback.dto';

export interface ConnectResult {
  accountsConnected: number;
}

@Injectable()
export class MetaOAuthService {
  private readonly logger = new Logger(MetaOAuthService.name);

  constructor(
    private readonly config: AppConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: TenantPrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ── Connect URL ─────────────────────────────────────────────────────────────

  async buildConnectUrl(tenantId: string, returnUrl?: string): Promise<string> {
    const nonce = randomUUID();
    const state: OAuthState = {
      nonce,
      tenantId,
      issuedAt: Date.now(),
      returnUrl,
    };
    await this.redis.set(
      `${OAUTH_STATE_KEY_PREFIX}${nonce}`,
      JSON.stringify(state),
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );
    return buildAuthUrl(
      this.config.metaAppId,
      this.config.metaRedirectUri,
      nonce,
    );
  }

  // ── State validation (single-use) ───────────────────────────────────────────

  async validateAndConsumeState(stateParam: string): Promise<OAuthState> {
    // Atomic GET + DELETE: prevents replay even under concurrent requests
    const raw = await this.redis.getdel(`${OAUTH_STATE_KEY_PREFIX}${stateParam}`);

    if (raw === null) {
      throw new UnauthorizedException('OAuth state is invalid or expired');
    }

    const parsed = oauthStateSchema.parse(JSON.parse(raw));

    // Defense-in-depth: timing-safe nonce comparison
    const storedNonce = Buffer.from(parsed.nonce, 'utf8');
    const submittedNonce = Buffer.from(stateParam, 'utf8');
    if (
      storedNonce.length !== submittedNonce.length ||
      !timingSafeEqual(storedNonce, submittedNonce)
    ) {
      throw new UnauthorizedException('OAuth state nonce mismatch');
    }

    // Belt-and-suspenders expiry check (TTL handles it, but let's be explicit)
    if (Date.now() - parsed.issuedAt > OAUTH_STATE_TTL_SECONDS * 1000) {
      throw new UnauthorizedException('OAuth state expired');
    }

    return parsed;
  }

  // ── Callback processing (called inside tenantContext.run()) ─────────────────

  async processCallback(code: string, state: OAuthState): Promise<ConnectResult> {
    // Step 1: Exchange code for short-lived user token
    const shortLivedToken = await exchangeCodeForToken(
      META_GRAPH_BASE_URL,
      this.config.metaAppId,
      this.config.metaAppSecret,
      this.config.metaRedirectUri,
      code,
    );

    // Step 2: Exchange for long-lived user token (60-day window for page token derivation)
    const { access_token: longLivedToken } = await getLongLivedToken(
      META_GRAPH_BASE_URL,
      this.config.metaAppId,
      this.config.metaAppSecret,
      shortLivedToken,
    );

    // Step 3: Retrieve pages (page tokens derived from long-lived token are non-expiring)
    const pages = await getPages(META_GRAPH_BASE_URL, longLivedToken);

    // longLivedToken no longer needed — do NOT log or persist it

    this.logger.debug({ tenantId: state.tenantId, pageCount: pages.length }, 'Pages retrieved');

    let accountsConnected = 0;
    for (const page of pages) {
      accountsConnected += await this.connectPage(page, state.tenantId);
    }

    return { accountsConnected };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async connectPage(page: MetaPage, tenantId: string): Promise<number> {
    // Encrypt token FIRST — never log or store plaintext page tokens
    const encryptedToken = this.crypto.encrypt(page.access_token);

    // Fetch IG account info before transaction (avoids long-running I/O inside DB tx)
    let igDisplayName: string | undefined;
    const igId = page.instagram_business_account?.id;
    if (igId) {
      try {
        const igAccount = await getInstagramAccount(META_GRAPH_BASE_URL, igId, page.access_token);
        igDisplayName = igAccount.username ?? igAccount.name;
      } catch (err) {
        // Non-fatal: connect FB page even if IG profile fetch fails
        this.logger.warn(
          { pageId: page.id, igId, error: err instanceof Error ? err.message : 'unknown' },
          'Failed to fetch IG profile — will use igId as display name',
        );
      }
    }

    // Upsert inside a transaction (RLS is set by TenantPrismaService.run())
    await this.prisma.run(async (tx) => {
      await this.upsertSocialAccount(tx, {
        tenantId,
        platform: 'FACEBOOK',
        externalId: page.id,
        displayName: page.name,
        encryptedToken,
        tasks: page.tasks ?? [],
      });

      if (igId) {
        await this.upsertSocialAccount(tx, {
          tenantId,
          platform: 'INSTAGRAM',
          externalId: igId,
          displayName: igDisplayName ?? igId,
          encryptedToken, // same page token — IG Graph API accepts it for linked accounts
          tasks: [],
        });
      }
    });

    // Subscribe webhook after transaction — non-blocking failure
    await this.subscribePageWebhook(page.id, page.access_token);

    return igId ? 2 : 1;
  }

  private async upsertSocialAccount(
    tx: Parameters<Parameters<TenantPrismaService['run']>[0]>[0],
    opts: {
      tenantId: string;
      platform: 'FACEBOOK' | 'INSTAGRAM';
      externalId: string;
      displayName: string;
      encryptedToken: string;
      tasks: string[];
    },
  ): Promise<void> {
    const { tenantId, platform, externalId, displayName, encryptedToken, tasks } = opts;

    // Check if this tenant already has this account (RLS ensures only this tenant's rows visible)
    const existing = await tx.socialAccount.findUnique({
      where: { platform_externalId: { platform, externalId } },
      select: { id: true },
    });

    if (existing) {
      await tx.socialAccount.update({
        where: { id: existing.id },
        data: {
          displayName,
          accessTokenEncrypted: encryptedToken,
          tokenExpiresAt: null,
          permissionsGranted: tasks,
          status: 'ACTIVE',
          webhookSubscribedAt: null,
          webhookSubscriptionError: null,
        },
      });
    } else {
      try {
        await tx.socialAccount.create({
          data: {
            tenantId,
            platform,
            externalId,
            displayName,
            accessTokenEncrypted: encryptedToken,
            tokenExpiresAt: null,
            permissionsGranted: tasks,
            status: 'ACTIVE',
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException(
            `${platform} account ${externalId} is already connected by another organization`,
          );
        }
        throw err;
      }
    }
  }

  private async subscribePageWebhook(pageId: string, pageToken: string): Promise<void> {
    try {
      await subscribeWebhook(META_GRAPH_BASE_URL, pageId, pageToken);

      await this.prisma.run(async (tx) => {
        await tx.socialAccount.update({
          where: { platform_externalId: { platform: 'FACEBOOK', externalId: pageId } },
          data: { webhookSubscribedAt: new Date(), webhookSubscriptionError: null },
        });
      });

      this.logger.debug({ pageId }, 'Webhook subscribed — account is operational');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        { pageId, error: errorMessage },
        'Webhook subscription failed — account connected but NOT operational',
      );
      await this.prisma
        .run(async (tx) => {
          await tx.socialAccount.update({
            where: { platform_externalId: { platform: 'FACEBOOK', externalId: pageId } },
            data: { webhookSubscriptionError: errorMessage },
          });
        })
        .catch(() => {
          /* best effort */
        });
    }
  }
}
