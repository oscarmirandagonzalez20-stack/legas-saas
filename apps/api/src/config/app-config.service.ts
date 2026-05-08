import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): 'development' | 'test' | 'production' {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get logLevel(): string {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get metaAppId(): string {
    return this.config.get('META_APP_ID', { infer: true });
  }

  get metaAppSecret(): string {
    return this.config.get('META_APP_SECRET', { infer: true });
  }

  get metaVerifyToken(): string {
    return this.config.get('META_VERIFY_TOKEN', { infer: true });
  }

  get metaRedirectUri(): string {
    return this.config.get('META_REDIRECT_URI', { infer: true });
  }

  get encryptionKey(): string {
    return this.config.get('ENCRYPTION_KEY', { infer: true });
  }

  get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', { infer: true });
  }
}
