import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaApiError } from './errors';
import {
  buildAuthUrl,
  exchangeCodeForToken,
  getInstagramAccount,
  getLongLivedToken,
  getPages,
  META_OAUTH_SCOPES,
} from './oauth';

const BASE = 'https://graph.facebook.com/v21.0';
const APP_ID = 'test_app_id';
const APP_SECRET = 'test_secret';
const REDIRECT = 'https://api.example.com/social-accounts/meta/callback';

// ── buildAuthUrl ──────────────────────────────────────────────────────────────

describe('buildAuthUrl', () => {
  it('returns a Facebook dialog URL', () => {
    const url = buildAuthUrl(APP_ID, REDIRECT, 'nonce-abc');
    expect(url).toMatch(/^https:\/\/www\.facebook\.com\/dialog\/oauth\?/);
  });

  it('includes client_id, redirect_uri, state, response_type=code', () => {
    const url = new URL(buildAuthUrl(APP_ID, REDIRECT, 'my-nonce'));
    expect(url.searchParams.get('client_id')).toBe(APP_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('state')).toBe('my-nonce');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes all default scopes', () => {
    const url = new URL(buildAuthUrl(APP_ID, REDIRECT, 'n'));
    const scope = url.searchParams.get('scope') ?? '';
    for (const s of META_OAUTH_SCOPES) {
      expect(scope).toContain(s);
    }
  });

  it('accepts custom scopes', () => {
    const url = new URL(buildAuthUrl(APP_ID, REDIRECT, 'n', ['pages_show_list']));
    expect(url.searchParams.get('scope')).toBe('pages_show_list');
  });
});

// ── fetch-based functions ─────────────────────────────────────────────────────

describe('exchangeCodeForToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns access_token on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'short-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const token = await exchangeCodeForToken(BASE, APP_ID, APP_SECRET, REDIRECT, 'auth-code');
    expect(token).toBe('short-token');
  });

  it('throws MetaApiError on Meta error response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Invalid code', code: 100 } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(exchangeCodeForToken(BASE, APP_ID, APP_SECRET, REDIRECT, 'bad')).rejects.toThrow(
      MetaApiError,
    );
  });

  it('includes error code from Meta response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Token expired', code: 190 } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const err = await exchangeCodeForToken(BASE, APP_ID, APP_SECRET, REDIRECT, 'x').catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(MetaApiError);
    expect((err as MetaApiError).code).toBe(190);
  });
});

describe('getLongLivedToken', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns access_token and expires_in', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'long-token', token_type: 'bearer', expires_in: 5183944 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await getLongLivedToken(BASE, APP_ID, APP_SECRET, 'short-token');
    expect(result.access_token).toBe('long-token');
    expect(result.expires_in).toBe(5183944);
  });
});

describe('getPages', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns array of pages', async () => {
    const pageData = {
      data: [
        { id: 'page1', name: 'My Law Firm', access_token: 'page-token-1', tasks: ['ANALYZE'] },
      ],
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(pageData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const pages = await getPages(BASE, 'user-token');
    expect(pages).toHaveLength(1);
    expect(pages[0]?.id).toBe('page1');
    expect(pages[0]?.access_token).toBe('page-token-1');
  });

  it('returns pages with instagram_business_account when linked', async () => {
    const pageData = {
      data: [
        {
          id: 'page1',
          name: 'My Firm',
          access_token: 'page-token',
          instagram_business_account: { id: 'ig123' },
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(pageData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const pages = await getPages(BASE, 'user-token');
    expect(pages[0]?.instagram_business_account?.id).toBe('ig123');
  });
});

describe('getInstagramAccount', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns id, username, and name', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'ig123', username: 'lawfirm_mx', name: 'Law Firm MX' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const account = await getInstagramAccount(BASE, 'ig123', 'page-token');
    expect(account.id).toBe('ig123');
    expect(account.username).toBe('lawfirm_mx');
  });
});
