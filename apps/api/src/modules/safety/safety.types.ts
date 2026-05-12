import { z } from 'zod';

// ── Automation modes ──────────────────────────────────────────────────────────

export enum AutomationMode {
  /** AI generates suggestions only — human sends every response manually. */
  MANUAL = 'MANUAL',
  /** AI drafts the response — human approves before delivery. */
  SEMI_AUTOMATIC = 'SEMI_AUTOMATIC',
  /** AI sends automatically within strict rate and content limits. */
  SAFE_AUTOMATIC = 'SAFE_AUTOMATIC',
}

// ── Action categories ─────────────────────────────────────────────────────────

export enum SafetyAction {
  SEND_DM = 'SEND_DM',
  REPLY_COMMENT = 'REPLY_COMMENT',
  LIKE_COMMENT = 'LIKE_COMMENT',
  PROCESS_WEBHOOK = 'PROCESS_WEBHOOK',
}

// ── Safety decision ───────────────────────────────────────────────────────────

export enum SafetyDecision {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
  DELAY = 'DELAY',
}

// ── Circuit breaker states ────────────────────────────────────────────────────

export enum CircuitState {
  /** Normal — requests flow through. */
  CLOSED = 'CLOSED',
  /** Too many consecutive failures — all outgoing actions blocked. */
  OPEN = 'OPEN',
  /** Timeout expired — allow one probe request to test recovery. */
  HALF_OPEN = 'HALF_OPEN',
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export const safetyCheckDtoSchema = z.object({
  accountId: z.string().uuid(),
  tenantId: z.string().uuid(),
  action: z.nativeEnum(SafetyAction),
  recipientUserId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  content: z.string().max(4_096).optional(),
});

export type SafetyCheckDto = z.infer<typeof safetyCheckDtoSchema>;

// ── Result types ──────────────────────────────────────────────────────────────

export interface SafetyResult {
  decision: SafetyDecision;
  reason?: string;
  delayMs?: number;
  blockedBy?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limitKey: string;
}

export interface ComplianceResult {
  passed: boolean;
  violations: string[];
}

export interface ContentSafetyResult {
  safe: boolean;
  issues: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  openedAt: number | null;
  reason: string | null;
  checkpoint: boolean;
}

export interface EffectiveLimits {
  maxMsgPerMin: number;
  maxMsgPerHour: number;
  maxMsgPerDay: number;
  maxDmsPerHour: number;
  maxCommentRepliesPerHour: number;
  maxResponsesPerUser: number;
  maxResponsesPerConversation: number;
  warmupActive: boolean;
  warmupFactor: number;
}

export type BaseLimits = Omit<EffectiveLimits, 'warmupActive' | 'warmupFactor'>;
