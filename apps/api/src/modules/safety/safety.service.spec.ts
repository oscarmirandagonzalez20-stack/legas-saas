import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { SafetyService } from './safety.service';
import { MetaRateLimiterService } from './services/meta-rate-limiter.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HumanizationService } from './services/humanization.service';
import { AntiSpamService } from './services/anti-spam.service';
import { MetaComplianceService } from './services/meta-compliance.service';
import { ContentSafetyService } from './services/content-safety.service';
import { AccountProtectionService } from './services/account-protection.service';
import { AppConfigService } from '@/config/app-config.service';
import { AutomationMode, SafetyAction, SafetyDecision, CircuitState } from './safety.types';
import type { SafetyCheckDto, EffectiveLimits } from './safety.types';

const ACCOUNT = '00000000-0000-0000-0000-000000000001';
const TENANT = '00000000-0000-0000-0000-000000000002';
const CONV = '00000000-0000-0000-0000-000000000003';

const fullLimits: EffectiveLimits = {
  maxMsgPerMin: 2,
  maxMsgPerHour: 30,
  maxMsgPerDay: 200,
  maxDmsPerHour: 20,
  maxCommentRepliesPerHour: 30,
  maxResponsesPerUser: 3,
  maxResponsesPerConversation: 5,
  warmupActive: false,
  warmupFactor: 1.0,
};

const allowedRate = { allowed: true, remaining: 10, resetAt: Date.now() + 60_000, limitKey: 'k' };

const mockConfig = {
  safeMode: false,
  automationMode: AutomationMode.SAFE_AUTOMATIC,
  metaMaxMsgPerMin: 2,
  metaMaxMsgPerHour: 30,
  metaMaxMsgPerDay: 200,
  metaMaxDmsPerHour: 20,
  metaMaxCommentRepliesPerHour: 30,
  metaMaxResponsesPerUser: 3,
  metaMaxResponsesPerConv: 5,
  metaHumanizationMinDelayMs: 20_000,
  metaHumanizationMaxDelayMs: 180_000,
  metaCbThreshold: 3,
  metaCbTimeoutMs: 900_000,
};

const mockCompliance = { check: vi.fn() };
const mockCircuitBreaker = {
  isAllowed: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
};
const mockAccountProtection = {
  isPaused: vi.fn(),
  getEffectiveLimits: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
};
const mockRateLimiter = {
  checkAccountMsgPerMin: vi.fn(),
  checkAccountMsgPerHour: vi.fn(),
  checkAccountMsgPerDay: vi.fn(),
  checkDmsPerHour: vi.fn(),
  checkCommentRepliesPerHour: vi.fn(),
  checkResponsesPerUser: vi.fn(),
  checkResponsesPerConversation: vi.fn(),
};
const mockContentSafety = { check: vi.fn() };
const mockAntiSpam = {
  isDuplicateMessage: vi.fn(),
  recordSentMessage: vi.fn(),
};
const mockHumanization = { getDelay: vi.fn() };

describe('SafetyService', () => {
  let service: SafetyService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default happy-path stubs
    mockCompliance.check.mockReturnValue({ passed: true, violations: [] });
    mockCircuitBreaker.isAllowed.mockResolvedValue({ allowed: true });
    mockCircuitBreaker.recordSuccess.mockResolvedValue(undefined);
    mockCircuitBreaker.recordFailure.mockResolvedValue(CircuitState.CLOSED);
    mockAccountProtection.isPaused.mockResolvedValue(false);
    mockAccountProtection.getEffectiveLimits.mockResolvedValue(fullLimits);
    mockAccountProtection.recordSuccess.mockResolvedValue(51);
    mockAccountProtection.recordFailure.mockResolvedValue({ score: 40, autoPaused: false });
    mockRateLimiter.checkAccountMsgPerMin.mockResolvedValue(allowedRate);
    mockRateLimiter.checkAccountMsgPerHour.mockResolvedValue(allowedRate);
    mockRateLimiter.checkAccountMsgPerDay.mockResolvedValue(allowedRate);
    mockRateLimiter.checkDmsPerHour.mockResolvedValue(allowedRate);
    mockRateLimiter.checkCommentRepliesPerHour.mockResolvedValue(allowedRate);
    mockRateLimiter.checkResponsesPerUser.mockResolvedValue(allowedRate);
    mockRateLimiter.checkResponsesPerConversation.mockResolvedValue(allowedRate);
    mockContentSafety.check.mockReturnValue({ safe: true, issues: [], severity: 'LOW' });
    mockAntiSpam.isDuplicateMessage.mockResolvedValue(false);
    mockHumanization.getDelay.mockReturnValue(45_000);

    const module = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: AppConfigService, useValue: mockConfig },
        { provide: MetaRateLimiterService, useValue: mockRateLimiter },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: HumanizationService, useValue: mockHumanization },
        { provide: AntiSpamService, useValue: mockAntiSpam },
        { provide: MetaComplianceService, useValue: mockCompliance },
        { provide: ContentSafetyService, useValue: mockContentSafety },
        { provide: AccountProtectionService, useValue: mockAccountProtection },
      ],
    }).compile();

    service = module.get(SafetyService);
  });

  describe('check — ALLOW path', () => {
    it('returns ALLOW with delayMs for a valid outgoing DM', async () => {
      const dto: SafetyCheckDto = {
        accountId: ACCOUNT,
        tenantId: TENANT,
        action: SafetyAction.SEND_DM,
        content: 'Hola, ¿le puedo ayudar con asesoría legal?',
        conversationId: CONV,
      };

      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.ALLOW);
      expect(result.delayMs).toBe(45_000);
    });

    it('allows PROCESS_WEBHOOK without rate checks', async () => {
      const dto: SafetyCheckDto = {
        accountId: ACCOUNT,
        tenantId: TENANT,
        action: SafetyAction.PROCESS_WEBHOOK,
      };

      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.ALLOW);
      expect(mockRateLimiter.checkAccountMsgPerMin).not.toHaveBeenCalled();
    });
  });

  describe('check — BLOCK paths', () => {
    it('blocks when compliance fails', async () => {
      mockCompliance.check.mockReturnValue({
        passed: false,
        violations: ['SAFE_MODE active'],
      });

      const dto: SafetyCheckDto = { accountId: ACCOUNT, tenantId: TENANT, action: SafetyAction.SEND_DM };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('compliance');
    });

    it('blocks when circuit breaker is open', async () => {
      mockCircuitBreaker.isAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Circuit open — retry in 300s',
      });

      const dto: SafetyCheckDto = { accountId: ACCOUNT, tenantId: TENANT, action: SafetyAction.SEND_DM };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('circuit-breaker');
    });

    it('blocks when account is paused', async () => {
      mockAccountProtection.isPaused.mockResolvedValue(true);

      const dto: SafetyCheckDto = { accountId: ACCOUNT, tenantId: TENANT, action: SafetyAction.SEND_DM };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('account-protection');
    });

    it('blocks when rate limit exceeded', async () => {
      mockRateLimiter.checkAccountMsgPerMin.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        limitKey: 'k',
      });

      const dto: SafetyCheckDto = { accountId: ACCOUNT, tenantId: TENANT, action: SafetyAction.SEND_DM };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('rate-limiter');
    });

    it('blocks unsafe content', async () => {
      mockContentSafety.check.mockReturnValue({
        safe: false,
        issues: ['Spam keywords: mlm'],
        severity: 'HIGH',
      });

      const dto: SafetyCheckDto = {
        accountId: ACCOUNT,
        tenantId: TENANT,
        action: SafetyAction.SEND_DM,
        content: 'join our mlm',
      };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('content-safety');
    });

    it('blocks duplicate messages', async () => {
      mockAntiSpam.isDuplicateMessage.mockResolvedValue(true);

      const dto: SafetyCheckDto = {
        accountId: ACCOUNT,
        tenantId: TENANT,
        action: SafetyAction.SEND_DM,
        content: 'Hello',
        conversationId: CONV,
      };
      const result = await service.check(dto);

      expect(result.decision).toBe(SafetyDecision.BLOCK);
      expect(result.blockedBy).toBe('anti-spam');
    });
  });

  describe('recordOutcome', () => {
    it('updates circuit breaker and trust score on success', async () => {
      await service.recordOutcome(ACCOUNT, true);

      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalledWith(ACCOUNT);
      expect(mockAccountProtection.recordSuccess).toHaveBeenCalledWith(ACCOUNT);
    });

    it('records failure with reason on failure', async () => {
      await service.recordOutcome(ACCOUNT, false, 'token expired');

      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledWith(
        ACCOUNT,
        'token expired',
        mockConfig.metaCbThreshold,
      );
      expect(mockAccountProtection.recordFailure).toHaveBeenCalledWith(ACCOUNT);
    });
  });
});
