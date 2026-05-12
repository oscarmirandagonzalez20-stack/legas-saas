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

  get encryptionKey(): string {
    return this.config.get('ENCRYPTION_KEY', { infer: true });
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

  // ── URLs — may be empty until services are wired up ────────────────────────

  get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', { infer: true });
  }

  get apiUrl(): string {
    return this.config.get('API_URL', { infer: true });
  }

  // ── Meta — empty string when not yet configured ───────────────────────────

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

  // ── Auth ──────────────────────────────────────────────────────────────────

  get clerkSecretKey(): string {
    return this.config.get('CLERK_SECRET_KEY', { infer: true });
  }

  // ── AI providers ──────────────────────────────────────────────────────────

  get anthropicApiKey(): string {
    return this.config.get('ANTHROPIC_API_KEY', { infer: true });
  }

  get openaiApiKey(): string {
    return this.config.get('OPENAI_API_KEY', { infer: true });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  get stripeSecretKey(): string {
    return this.config.get('STRIPE_SECRET_KEY', { infer: true });
  }

  get stripeWebhookSecret(): string {
    return this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
  }

  get mercadopagoAccessToken(): string {
    return this.config.get('MERCADOPAGO_ACCESS_TOKEN', { infer: true });
  }
}
