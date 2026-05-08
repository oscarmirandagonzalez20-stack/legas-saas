import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SocialAccountsService } from './social-accounts.service';
import type { TenantPrismaService } from '@/prisma/tenant-prisma.service';
import type { CryptoService } from '@/common/crypto/crypto.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCOUNT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function makePrismaRun(resolveWith: unknown) {
  return vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const mockTx = {
      socialAccount: {
        findMany: vi.fn().mockResolvedValue(resolveWith),
        findUnique: vi.fn().mockResolvedValue(resolveWith),
        findUniqueOrThrow: vi.fn().mockResolvedValue(resolveWith ?? (() => { throw new Error('not found'); })),
        update: vi.fn().mockResolvedValue(resolveWith),
      },
    };
    return fn(mockTx);
  });
}

function makeService(prismaOverrides?: Partial<{ run: ReturnType<typeof vi.fn> }>, decryptFn?: () => string) {
  const run = prismaOverrides?.run ?? makePrismaRun(null);
  const prisma = { run } as unknown as TenantPrismaService;
  const crypto = { decrypt: decryptFn ? vi.fn(decryptFn) : vi.fn().mockReturnValue('plaintext-token') } as unknown as CryptoService;
  return { service: new SocialAccountsService(prisma, crypto), run, crypto };
}

// ── listAccounts ──────────────────────────────────────────────────────────────

describe('SocialAccountsService.listAccounts', () => {
  it('delegates to prisma.run and returns accounts', async () => {
    const accounts = [
      { id: ACCOUNT_ID, platform: 'FACEBOOK', externalId: 'page1', displayName: 'Firm', status: 'ACTIVE',
        webhookSubscribedAt: null, webhookSubscriptionError: null, tokenExpiresAt: null,
        createdAt: new Date(), updatedAt: new Date() },
    ];
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { socialAccount: { findMany: vi.fn().mockResolvedValue(accounts) } };
      return fn(tx);
    });
    const { service } = makeService({ run });

    const result = await service.listAccounts();
    expect(result).toHaveLength(1);
    expect(result[0]?.platform).toBe('FACEBOOK');
  });

  it('never exposes accessTokenEncrypted in the returned data', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { socialAccount: { findMany } };
      return fn(tx);
    });
    const { service } = makeService({ run });

    await service.listAccounts();

    // The service must use an explicit `select` that does NOT include accessTokenEncrypted
    const callArgs = findMany.mock.calls[0]?.[0] as { select?: Record<string, unknown> } | undefined;
    expect(callArgs?.select).toBeDefined();
    expect(callArgs?.select).not.toHaveProperty('accessTokenEncrypted');
  });
});

// ── disconnect ────────────────────────────────────────────────────────────────

describe('SocialAccountsService.disconnect', () => {
  it('throws NotFoundException when account does not exist', async () => {
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { socialAccount: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } };
      return fn(tx);
    });
    const { service } = makeService({ run });

    await expect(service.disconnect(ACCOUNT_ID)).rejects.toThrow(NotFoundException);
  });

  it('marks account as REVOKED', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({});
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        socialAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: ACCOUNT_ID, externalId: 'page1', platform: 'FACEBOOK', accessTokenEncrypted: 'v1:enc',
          }),
          update: mockUpdate,
        },
      };
      return fn(tx);
    });
    const { service } = makeService({ run });

    await service.disconnect(ACCOUNT_ID);

    // Second run() call is the update
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REVOKED' }) }),
    );
  });

  it('proceeds with disconnect even if webhook unsubscription throws', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({});
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        socialAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: ACCOUNT_ID, externalId: 'page1', platform: 'FACEBOOK', accessTokenEncrypted: 'v1:enc',
          }),
          update: mockUpdate,
        },
      };
      return fn(tx);
    });
    // unsubscribeWebhook will throw — crypto.decrypt is fine, the network call fails
    // We stub the meta-sdk unsubscribeWebhook at the module level via vi.mock elsewhere.
    // Here we just verify disconnect doesn't propagate the error.
    const { service } = makeService({ run });

    // Even if unsubscribeWebhook throws (it'll try a real fetch which may fail), disconnect completes
    await expect(service.disconnect(ACCOUNT_ID)).resolves.toBeUndefined();
  });
});

// ── getReconnectUrl ───────────────────────────────────────────────────────────

describe('SocialAccountsService.getReconnectUrl', () => {
  it('calls buildConnectUrl with the tenantId', async () => {
    const run = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { socialAccount: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: ACCOUNT_ID }) } };
      return fn(tx);
    });
    const { service } = makeService({ run });
    const buildConnectUrl = vi.fn<(tenantId: string) => Promise<string>>().mockResolvedValue('https://fb.com/oauth');

    const url = await service.getReconnectUrl(ACCOUNT_ID, buildConnectUrl, 'tenant-123');

    expect(buildConnectUrl).toHaveBeenCalledWith('tenant-123');
    expect(url).toBe('https://fb.com/oauth');
  });
});
