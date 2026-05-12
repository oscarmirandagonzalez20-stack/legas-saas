import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@/config/app-config.service';
import { MetaRateLimiterService } from './services/meta-rate-limiter.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HumanizationService } from './services/humanization.service';
import { AntiSpamService } from './services/anti-spam.service';
import { MetaComplianceService } from './services/meta-compliance.service';
import { ContentSafetyService } from './services/content-safety.service';
import { AccountProtectionService } from './services/account-protection.service';
import { SafetyDecision, SafetyAction } from './safety.types';
import type {
  SafetyCheckDto,
  SafetyResult,
  BaseLimits,
  EffectiveLimits,
} from './safety.types';

const OUTGOING: ReadonlySet<SafetyAction> = new Set([
  SafetyAction.SEND_DM,
  SafetyAction.REPLY_COMMENT,
  SafetyAction.LIKE_COMMENT,
]);

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly rateLimiter: MetaRateLimiterService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly humanization: HumanizationService,
    private readonly antiSpam: AntiSpamService,
    private readonly compliance: MetaComplianceService,
    private readonly contentSafety: ContentSafetyService,
    private readonly accountProtection: AccountProtectionService,
  ) {}

  // ── Main safety gate ───────────────────────────────────────────────────────
  // Call this before any outgoing Meta API action.
  // Returns ALLOW with a recommended delayMs, or BLOCK with a reason.
  // If ALLOW, callers MUST:
  //   1. Sleep for result.delayMs (humanization)
  //   2. Call recordOutcome() after the API call completes

  async check(dto: SafetyCheckDto): Promise<SafetyResult> {
    // ── Step 1: Compliance — mode and content policy gates ────────────────────
    const compliance = this.compliance.check(
      dto,
      this.config.automationMode,
      this.config.safeMode,
    );
    if (!compliance.passed) {
      return {
        decision: SafetyDecision.BLOCK,
        reason: compliance.violations.join('; '),
        blockedBy: 'compliance',
      };
    }

    // ── Step 2: Circuit breaker — per-account failure state ───────────────────
    const cb = await this.circuitBreaker.isAllowed(
      dto.accountId,
      this.config.metaCbTimeoutMs,
    );
    if (!cb.allowed) {
      return {
        decision: SafetyDecision.BLOCK,
        reason: cb.reason,
        blockedBy: 'circuit-breaker',
      };
    }

    // ── Step 3: Account protection — pauses and trust score ───────────────────
    const paused = await this.accountProtection.isPaused(dto.accountId);
    if (paused) {
      return {
        decision: SafetyDecision.BLOCK,
        reason: 'Account is on a temporary safety pause',
        blockedBy: 'account-protection',
      };
    }

    // Incoming webhook processing never needs rate/content checks — done here
    if (!OUTGOING.has(dto.action)) {
      return { decision: SafetyDecision.ALLOW };
    }

    // ── Step 4: Effective limits (warmup + trust factor applied) ──────────────
    const base = this.buildBaseLimits();
    const limits = await this.accountProtection.getEffectiveLimits(dto.accountId, base);

    // ── Step 5: Rate limits ───────────────────────────────────────────────────
    const rateViolation = await this.checkRateLimits(dto, limits);
    if (rateViolation) {
      return {
        decision: SafetyDecision.BLOCK,
        reason: rateViolation,
        blockedBy: 'rate-limiter',
      };
    }

    // ── Step 6: Content safety ────────────────────────────────────────────────
    if (dto.content) {
      const cs = this.contentSafety.check(dto.content);
      if (!cs.safe) {
        return {
          decision: SafetyDecision.BLOCK,
          reason: `Content blocked (${cs.severity}): ${cs.issues.join('; ')}`,
          blockedBy: 'content-safety',
        };
      }
    }

    // ── Step 7: Anti-spam — exact duplicate in this conversation ─────────────
    if (dto.content && dto.conversationId) {
      const dup = await this.antiSpam.isDuplicateMessage(
        dto.accountId,
        dto.conversationId,
        dto.content,
      );
      if (dup) {
        return {
          decision: SafetyDecision.BLOCK,
          reason: 'Duplicate message already sent in this conversation',
          blockedBy: 'anti-spam',
        };
      }
    }

    // ── Step 8: Humanization delay ────────────────────────────────────────────
    const delayMs = this.humanization.getDelay({
      minDelayMs: this.config.metaHumanizationMinDelayMs,
      maxDelayMs: this.config.metaHumanizationMaxDelayMs,
    });

    this.logger.debug(
      `ALLOW account=${dto.accountId} action=${dto.action} delay=${String(delayMs)}ms` +
      (limits.warmupActive ? ` [warmup ${(limits.warmupFactor * 100).toFixed(0)}%]` : ''),
    );

    return { decision: SafetyDecision.ALLOW, delayMs };
  }

  // Call this after every outgoing Meta API call to update circuit breaker and trust score.
  async recordOutcome(
    accountId: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    if (success) {
      await Promise.all([
        this.circuitBreaker.recordSuccess(accountId),
        this.accountProtection.recordSuccess(accountId),
      ]);
    } else {
      await Promise.all([
        this.circuitBreaker.recordFailure(
          accountId,
          failureReason ?? 'outgoing Meta API failure',
          this.config.metaCbThreshold,
        ),
        this.accountProtection.recordFailure(accountId),
      ]);
    }
  }

  // Call this after a message is successfully delivered to record it for anti-spam.
  async recordSentMessage(
    accountId: string,
    conversationId: string,
    content: string,
  ): Promise<void> {
    await this.antiSpam.recordSentMessage(accountId, conversationId, content);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async checkRateLimits(
    dto: SafetyCheckDto,
    limits: EffectiveLimits,
  ): Promise<string | null> {
    const checks: Promise<{ allowed: boolean; reason: string }>[] = [
      this.rateLimiter
        .checkAccountMsgPerMin(dto.accountId, limits.maxMsgPerMin)
        .then((r) => ({ allowed: r.allowed, reason: `per-minute limit (${String(limits.maxMsgPerMin)}/min)` })),

      this.rateLimiter
        .checkAccountMsgPerHour(dto.accountId, limits.maxMsgPerHour)
        .then((r) => ({ allowed: r.allowed, reason: `per-hour limit (${String(limits.maxMsgPerHour)}/hr)` })),

      this.rateLimiter
        .checkAccountMsgPerDay(dto.accountId, limits.maxMsgPerDay)
        .then((r) => ({ allowed: r.allowed, reason: `per-day limit (${String(limits.maxMsgPerDay)}/day)` })),
    ];

    if (dto.recipientUserId) {
      checks.push(
        this.rateLimiter
          .checkResponsesPerUser(dto.accountId, dto.recipientUserId, limits.maxResponsesPerUser)
          .then((r) => ({ allowed: r.allowed, reason: `per-user limit (${String(limits.maxResponsesPerUser)}/user/day)` })),
      );
    }

    if (dto.conversationId) {
      checks.push(
        this.rateLimiter
          .checkResponsesPerConversation(dto.conversationId, limits.maxResponsesPerConversation)
          .then((r) => ({ allowed: r.allowed, reason: `per-conversation limit (${String(limits.maxResponsesPerConversation)}/conv/day)` })),
      );
    }

    if (dto.action === SafetyAction.SEND_DM) {
      checks.push(
        this.rateLimiter
          .checkDmsPerHour(dto.accountId, limits.maxDmsPerHour)
          .then((r) => ({ allowed: r.allowed, reason: `DM per-hour limit (${String(limits.maxDmsPerHour)}/hr)` })),
      );
    }

    if (dto.action === SafetyAction.REPLY_COMMENT) {
      checks.push(
        this.rateLimiter
          .checkCommentRepliesPerHour(dto.accountId, limits.maxCommentRepliesPerHour)
          .then((r) => ({ allowed: r.allowed, reason: `comment-reply per-hour limit (${String(limits.maxCommentRepliesPerHour)}/hr)` })),
      );
    }

    const results = await Promise.all(checks);
    const violation = results.find((r) => !r.allowed);
    return violation ? `Rate limit exceeded: ${violation.reason}` : null;
  }

  private buildBaseLimits(): BaseLimits {
    return {
      maxMsgPerMin: this.config.metaMaxMsgPerMin,
      maxMsgPerHour: this.config.metaMaxMsgPerHour,
      maxMsgPerDay: this.config.metaMaxMsgPerDay,
      maxDmsPerHour: this.config.metaMaxDmsPerHour,
      maxCommentRepliesPerHour: this.config.metaMaxCommentRepliesPerHour,
      maxResponsesPerUser: this.config.metaMaxResponsesPerUser,
      maxResponsesPerConversation: this.config.metaMaxResponsesPerConv,
    };
  }
}
