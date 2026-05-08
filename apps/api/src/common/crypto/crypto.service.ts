import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';

const ALGORITHM = 'aes-256-gcm' as const;
const CURRENT_VERSION = 'v1' as const;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: AppConfigService) {
    this.key = Buffer.from(config.encryptionKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
      CURRENT_VERSION,
      iv.toString('hex'),
      ciphertext.toString('hex'),
      authTag.toString('hex'),
    ].join(':');
  }

  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 4) {
      throw new Error(`Invalid encrypted payload: expected 4 parts, got ${String(parts.length)}`);
    }
    const [version, ivHex, ciphertextHex, authTagHex] = parts as [string, string, string, string];

    if (!timingSafeEqual(Buffer.from(version, 'utf8'), Buffer.from(CURRENT_VERSION, 'utf8'))) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
      throw new Error('Invalid encrypted payload: wrong iv or authTag length');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
