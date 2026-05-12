import { Injectable, Logger } from '@nestjs/common';
import { AutomationMode, SafetyAction } from '../safety.types';
import type { SafetyCheckDto, ComplianceResult } from '../safety.types';

const MAX_DM_CHARS = 1_000;
const MAX_COMMENT_REPLY_CHARS = 500;
const MAX_LINKS_PER_MESSAGE = 1;
const MAX_EXCLAMATION_RATIO = 0.08; // 8%
const MIN_LENGTH_FOR_EXCLAMATION_CHECK = 40;

const OUTGOING: ReadonlySet<SafetyAction> = new Set([
  SafetyAction.SEND_DM,
  SafetyAction.REPLY_COMMENT,
  SafetyAction.LIKE_COMMENT,
]);

@Injectable()
export class MetaComplianceService {
  private readonly logger = new Logger(MetaComplianceService.name);

  check(
    dto: SafetyCheckDto,
    automationMode: AutomationMode,
    safeMode: boolean,
  ): ComplianceResult {
    const violations: string[] = [];

    // ── Gate 1: SAFE_MODE blocks all outgoing automation ─────────────────────
    if (safeMode && OUTGOING.has(dto.action)) {
      violations.push(
        'SAFE_MODE=true — all outgoing automation is disabled; ' +
        'set SAFE_MODE=false and META_AUTOMATION_MODE=SEMI_AUTOMATIC or SAFE_AUTOMATIC to enable',
      );
      return { passed: false, violations };
    }

    // ── Gate 2: Automation mode check ────────────────────────────────────────
    if (OUTGOING.has(dto.action) && automationMode === AutomationMode.MANUAL) {
      violations.push(
        'Automation mode is MANUAL — every outgoing message requires human approval; ' +
        'change META_AUTOMATION_MODE to SEMI_AUTOMATIC or SAFE_AUTOMATIC to allow this',
      );
      return { passed: false, violations };
    }

    // ── Gate 3: SEMI_AUTOMATIC requires pre-approval (caller responsibility) ──
    // SEMI_AUTOMATIC means the AI draft was presented to a human who approved it.
    // We trust that the caller has already obtained that approval before reaching check().

    // ── Content rules (apply to any action with content) ─────────────────────
    if (dto.content !== undefined && dto.content.length > 0) {
      this.validateContent(dto.action, dto.content, violations);
    }

    const passed = violations.length === 0;

    if (!passed) {
      this.logger.warn(
        `Compliance block: account=${dto.accountId} action=${dto.action} — ${violations.join('; ')}`,
      );
    }

    return { passed, violations };
  }

  private validateContent(
    action: SafetyAction,
    content: string,
    violations: string[],
  ): void {
    const maxChars = action === SafetyAction.SEND_DM ? MAX_DM_CHARS : MAX_COMMENT_REPLY_CHARS;

    if (content.length > maxChars) {
      violations.push(
        `Content too long: ${String(content.length)} chars (limit ${String(maxChars)} for ${action})`,
      );
    }

    const linkCount = (content.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > MAX_LINKS_PER_MESSAGE) {
      violations.push(`Too many links: ${String(linkCount)} (max ${String(MAX_LINKS_PER_MESSAGE)})`);
    }

    if (content.length >= MIN_LENGTH_FOR_EXCLAMATION_CHECK) {
      const exclamations = (content.match(/!/g) ?? []).length;
      const ratio = exclamations / content.length;
      if (ratio > MAX_EXCLAMATION_RATIO && exclamations > 3) {
        violations.push(
          `Excessive exclamation marks: ${String(exclamations)} (${(ratio * 100).toFixed(1)}%)`,
        );
      }
    }

    const prohibited = this.findProhibited(content);
    if (prohibited.length > 0) {
      violations.push(`Prohibited phrases: ${prohibited.join(', ')}`);
    }
  }

  private findProhibited(content: string): string[] {
    const lower = content.toLowerCase();
    const PROHIBITED = [
      'haz clic ahora', 'haz click ahora',
      'compra ahora', 'descuento especial',
      'oferta limitada', 'actúa ya', 'actua ya',
      'precio increíble', 'precio increible',
      '100% gratis', 'click here', 'buy now',
      'limited offer', 'act now',
    ];
    return PROHIBITED.filter((p) => lower.includes(p));
  }
}
