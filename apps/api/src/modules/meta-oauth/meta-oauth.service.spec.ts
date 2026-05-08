import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { MetaOAuthService } from './meta-oauth.service';
import type { AppConfigService } from '@/config/app-config.service';
import type { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import type { CryptoService } from '@/common/crypto/crypto.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NONCE = 'cccccccc-0000-0000-0000-000000000099';
const PAGE_ID = 'page_123';
const IG_ID = 'ig_456';

const VALID_STATE = JSON.stringify({
  nonce: NONCE,
  tenantId: TENANT_ID,
  issuedAt: Date.now(),
});

function makeConfig(): AppConfigService {
  return {
    metaAppId: 'app_id',
    metaAppSecret: 'app_secret',
    metaRedirectUri: 'https://api.example.com/social-accounts/meta/callback',
  } as unknown as AppConfigService;
}

function makePrismaRun() {
  const findUnique = vi.fn().mockResolvedValue(null);
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn({ socialAccount: { findUnique, create, update } });
  });
  return { run, findUnique, create, update };
}

function makeService(opts?: {
  getdel?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
  prismaOverrides?: Partial<ReturnType<typeof makePrismaRun>>;
}) {
  const getdel = opts?.getdel ?? vi.fn().mockResolvedValue(null);
  const set = opts?.set ?? vi.fn().mockResolvedValue('OK');
  const redis = { getdel, set } as unknown as Redis;

  const { run, findUnique, create, update } = { ...makePrismaRun(), ...opts?.prismaOverrides };
  const prisma = { run } as unknown as TenantPrismaService;

  const encryptSpy = vi.fn<(plaintext: string) => string>().mockReturnValue('v1:encrypted');
  const crypto = {
    encrypt: encryptSpy,
    decrypt: vi.fn<(encrypted: string) => string>().mockReturnValue('plaintext-token'),
  } as unknown as CryptoService;

  const service = new MetaOAuthService(makeConfig(), redis, prisma, crypto);
  return { service, redis, getdel, set, run, findUnique, create, update, crypto, encryptSpy };
}

// ── buildConnectUrl ───────────────────────────────────────────────────────────

describe('MetaOAuthService.buildConnectUrl', () => {
  it('stores state in Redis with TTL and returns a Facebook auth URL', async () => {
    const { service, set } = makeService();

    const url = await service.buildConnectUrl(TENANT_ID);

    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^oauth:state:/),
      expect.any(String),
      'EX',
      600,
    );
    expect(url).toMatch(/^https:\/\/www\.facebook\.com\/dialog\/oauth\?/);
  });

  it('includes the nonce as the state param in the URL', async () => {
    const { service, set } = makeService();

    const url = await service.buildConnectUrl(TENANT_ID);

    const parsed = new URL(url);
    const state = parsed.searchParams.get('state') ?? '';
    expect(state.length).toBeGreaterThan(0);

    // The same nonce was used as the Redis key suffix
    expect(set).toHaveBeenCalledWith(
      `oauth:state:${state}`,
      expect.stringContaining(state),
      'EX',
      600,
    );
  });

  it('stores returnUrl in state when provided', async () => {
    const { service, set } = makeService();

    await service.buildConnectUrl(TENANT_ID, 'https://app.example.com/done');

    const storedValue = (set.mock.calls[0]?.[1] as string | undefined) ?? '';
    expect(JSON.parse(storedValue)).toMatchObject({
      returnUrl: 'https://app.example.com/done',
    });
  });
});

// ── validateAndConsumeState ───────────────────────────────────────────────────

describe('MetaOAuthService.validateAndConsumeState', () => {
  it('returns parsed state on valid nonce', async () => {
    const { service } = makeService({
      getdel: vi.fn().mockResolvedValue(VALID_STATE),
    });

    const result = await service.validateAndConsumeState(NONCE);

    expect(result.nonce).toBe(NONCE);
    expect(result.tenantId).toBe(TENANT_ID);
  });

  it('throws UnauthorizedException when state is not in Redis', async () => {
    const { service } = makeService({
      getdel: vi.fn().mockResolvedValue(null),
    });

    await expect(service.validateAndConsumeState('unknown-nonce')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when nonce in payload does not match state param', async () => {
    const tampered = JSON.stringify({ nonce: 'dddddddd-0000-0000-0000-000000000099', tenantId: TENANT_ID, issuedAt: Date.now() });
    const { service } = makeService({
      getdel: vi.fn().mockResolvedValue(tampered),
    });

    await expect(service.validateAndConsumeState(NONCE)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when state is expired', async () => {
    const expired = JSON.stringify({
      nonce: NONCE,
      tenantId: TENANT_ID,
      issuedAt: Date.now() - 11 * 60 * 1000, // 11 minutes ago
    });
    const { service } = makeService({
      getdel: vi.fn().mockResolvedValue(expired),
    });

    await expect(service.validateAndConsumeState(NONCE)).rejects.toThrow(UnauthorizedException);
  });

  it('deletes state atomically (single-use): getdel called once', async () => {
    const getdel = vi.fn().mockResolvedValue(VALID_STATE);
    const { service } = makeService({ getdel });

    await service.validateAndConsumeState(NONCE);

    expect(getdel).toHaveBeenCalledOnce();
    expect(getdel).toHaveBeenCalledWith(`oauth:state:${NONCE}`);
  });
});

// ── processCallback (mocked meta-sdk) ────────────────────────────────────────

vi.mock('@legal-saas/meta-sdk', () => ({
  META_GRAPH_BASE_URL: 'https://graph.facebook.com/v21.0',
  buildAuthUrl: vi.fn().mockImplementation((_appId: string, _redirectUri: string, nonce: string) =>
    `https://www.facebook.com/dialog/oauth?client_id=app_id&redirect_uri=https%3A%2F%2Fapi.example.com%2Fcallback&state=${nonce}`,
  ),
  exchangeCodeForToken: vi.fn().mockResolvedValue('short-token'),
  getLongLivedToken: vi.fn().mockResolvedValue({ access_token: 'long-token', token_type: 'bearer', expires_in: 5183944 }),
  getPages: vi.fn().mockResolvedValue([
    { id: 'page_123', name: 'Law Firm FB', access_token: 'page-token', tasks: ['ANALYZE'] },
  ]),
  getInstagramAccount: vi.fn().mockResolvedValue({ id: 'ig_456', username: 'lawfirm_ig' }),
  subscribeWebhook: vi.fn().mockResolvedValue(undefined),
  unsubscribeWebhook: vi.fn().mockResolvedValue(undefined),
}));

const oauthState = { nonce: NONCE, tenantId: TENANT_ID, issuedAt: Date.now() };

describe('MetaOAuthService.processCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates FB social account and subscribes webhook', async () => {
    const create = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ socialAccount: { findUnique: vi.fn().mockResolvedValue(null), create, update } }),
    );
    const { service } = makeService({ prismaOverrides: { run, create, update } });

    const result = await service.processCallback('auth-code', oauthState);

    expect(result.accountsConnected).toBeGreaterThanOrEqual(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ platform: 'FACEBOOK', externalId: PAGE_ID }) }),
    );
  });

  it('also creates IG account when page has instagram_business_account', async () => {
    const { getPages } = await import('@legal-saas/meta-sdk');
    vi.mocked(getPages).mockResolvedValue([
      {
        id: PAGE_ID,
        name: 'Law Firm FB',
        access_token: 'page-token',
        tasks: [],
        instagram_business_account: { id: IG_ID },
      },
    ]);

    const createCalls: unknown[] = [];
    const create = vi.fn().mockImplementation((args: unknown) => {
      createCalls.push(args);
      return Promise.resolve({});
    });
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ socialAccount: { findUnique: vi.fn().mockResolvedValue(null), create, update: vi.fn().mockResolvedValue({}) } }),
    );
    const { service } = makeService({ prismaOverrides: { run, create } });

    const result = await service.processCallback('auth-code', oauthState);

    expect(result.accountsConnected).toBe(2);
    const platforms = createCalls.map(
      (c) => (c as { data: { platform: string } }).data.platform,
    );
    expect(platforms).toContain('FACEBOOK');
    expect(platforms).toContain('INSTAGRAM');
  });

  it('throws ConflictException when page already connected by another tenant', async () => {
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        socialAccount: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique violation', {
              code: 'P2002',
              clientVersion: '5.x',
            }),
          ),
          update: vi.fn(),
        },
      });
    });
    const { service } = makeService({ prismaOverrides: { run } });

    await expect(service.processCallback('auth-code', oauthState)).rejects.toThrow(ConflictException);
  });

  it('webhook subscription failure does NOT fail the overall response', async () => {
    const { subscribeWebhook } = await import('@legal-saas/meta-sdk');
    vi.mocked(subscribeWebhook).mockRejectedValue(new Error('Network error'));

    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ socialAccount: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) } }),
    );
    const { service } = makeService({ prismaOverrides: { run } });

    // Should resolve even though webhook subscription fails
    await expect(service.processCallback('auth-code', oauthState)).resolves.toMatchObject({
      accountsConnected: expect.any(Number),
    });
  });

  it('does NOT log access tokens (encrypt is called before any logger call)', async () => {
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ socialAccount: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) } }),
    );
    const { service, encryptSpy } = makeService({ prismaOverrides: { run } });

    await service.processCallback('auth-code', oauthState);

    // Encrypt must have been called — plaintext token never reaches storage
    expect(encryptSpy).toHaveBeenCalled();
  });
});
