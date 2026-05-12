import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.validation';
import { AutomationMode } from '@/modules/safety/safety.types';

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

  // ── Safety config ─────────────────────────────────────────────────────────

  get safeMode(): boolean {
    return this.config.get('SAFE_MODE', { infer: true });
  }

  get automationMode(): AutomationMode {
    return this.config.get('META_AUTOMATION_MODE', { infer: true });
  }

  get metaMaxMsgPerMin(): number {
    return this.config.get('META_MAX_MSG_PER_MIN', { infer: true });
  }

  get metaMaxMsgPerHour(): number {
    return this.config.get('META_MAX_MSG_PER_HOUR', { infer: true });
  }

  get metaMaxMsgPerDay(): number {
    return this.config.get('META_MAX_MSG_PER_DAY', { infer: true });
  }

  get metaMaxDmsPerHour(): number {
    return this.config.get('META_MAX_DMS_PER_HOUR', { infer: true });
  }

  get metaMaxCommentRepliesPerHour(): number {
    return this.config.get('META_MAX_COMMENT_REPLIES_PER_HOUR', { infer: true });
  }

  get metaMaxResponsesPerUser(): number {
    return this.config.get('META_MAX_RESPONSES_PER_USER', { infer: true });
  }

  get metaMaxResponsesPerConv(): number {
    return this.config.get('META_MAX_RESPONSES_PER_CONV', { infer: true });
  }

  get metaHumanizationMinDelayMs(): number {
    return this.config.get('META_HUMANIZATION_MIN_DELAY_MS', { infer: true });
  }

  get metaHumanizationMaxDelayMs(): number {
    return this.config.get('META_HUMANIZATION_MAX_DELAY_MS', { infer: true });
  }

  get metaCbThreshold(): number {
    return this.config.get('META_CB_THRESHOLD', { infer: true });
  }

  get metaCbTimeoutMs(): number {
    return this.config.get('META_CB_TIMEOUT_MS', { infer: true });
  }
}
