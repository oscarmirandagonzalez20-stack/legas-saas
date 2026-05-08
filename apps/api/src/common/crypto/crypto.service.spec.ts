import { describe, expect, it } from 'vitest';
import { CryptoService } from './crypto.service';
import type { AppConfigService } from '@/config/app-config.service';

// 32-byte test key as 64 hex chars
const TEST_KEY = 'a'.repeat(64);

function makeService(keyHex = TEST_KEY): CryptoService {
  const config = { encryptionKey: keyHex } as unknown as AppConfigService;
  return new CryptoService(config);
}

describe('CryptoService', () => {
  it('decrypt(encrypt(plaintext)) returns original plaintext', () => {
    const svc = makeService();
    const plaintext = 'EAABsbCS1iHgBOZA9super-secret-token-xyz';
    expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
  });

  it('encrypted payload starts with v1:', () => {
    const svc = makeService();
    expect(svc.encrypt('hello')).toMatch(/^v1:/);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const svc = makeService();
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('decrypt throws on a wrong key', () => {
    const svc1 = makeService('a'.repeat(64));
    const svc2 = makeService('b'.repeat(64));
    const encrypted = svc1.encrypt('secret');
    expect(() => svc2.decrypt(encrypted)).toThrow();
  });

  it('decrypt throws when auth tag is tampered', () => {
    const svc = makeService();
    const encrypted = svc.encrypt('secret');
    const parts = encrypted.split(':');
    // Flip last character of auth tag
    const last = parts[3] ?? '';
    parts[3] = last.slice(0, -1) + (last.endsWith('f') ? '0' : 'f');
    const tampered = parts.join(':');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('decrypt throws on unsupported version', () => {
    const svc = makeService();
    const encrypted = svc.encrypt('secret');
    const tampered = encrypted.replace(/^v1:/, 'v2:');
    expect(() => svc.decrypt(tampered)).toThrow('Unsupported encryption version');
  });

  it('decrypt throws on malformed payload (wrong part count)', () => {
    const svc = makeService();
    expect(() => svc.decrypt('v1:abc:def')).toThrow('expected 4 parts');
  });

  it('handles multi-byte UTF-8 content (emojis, CJK, accented chars)', () => {
    const svc = makeService();
    const plaintext = '🔐 Óscar — 法律SaaS — ñoño';
    expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
  });
});
