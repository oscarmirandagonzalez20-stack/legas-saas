import { describe, it, expect } from 'vitest';
import { MetaComplianceService } from './meta-compliance.service';
import { AutomationMode, SafetyAction } from '../safety.types';
import type { SafetyCheckDto } from '../safety.types';

const base: SafetyCheckDto = {
  accountId: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000002',
  action: SafetyAction.SEND_DM,
};

describe('MetaComplianceService', () => {
  const service = new MetaComplianceService();

  describe('SAFE_MODE gate', () => {
    it('blocks outgoing action when SAFE_MODE=true', () => {
      const result = service.check(base, AutomationMode.SAFE_AUTOMATIC, true);
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('SAFE_MODE');
    });

    it('allows incoming webhook action even in SAFE_MODE', () => {
      const dto: SafetyCheckDto = { ...base, action: SafetyAction.PROCESS_WEBHOOK };
      const result = service.check(dto, AutomationMode.SAFE_AUTOMATIC, true);
      expect(result.passed).toBe(true);
    });
  });

  describe('automation mode gate', () => {
    it('blocks outgoing action in MANUAL mode (SAFE_MODE off)', () => {
      const result = service.check(base, AutomationMode.MANUAL, false);
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('MANUAL');
    });

    it('allows outgoing action in SEMI_AUTOMATIC mode', () => {
      const result = service.check(base, AutomationMode.SEMI_AUTOMATIC, false);
      expect(result.passed).toBe(true);
    });

    it('allows outgoing action in SAFE_AUTOMATIC mode', () => {
      const result = service.check(base, AutomationMode.SAFE_AUTOMATIC, false);
      expect(result.passed).toBe(true);
    });
  });

  describe('content rules (SAFE_AUTOMATIC, SAFE_MODE=false)', () => {
    const mode = AutomationMode.SAFE_AUTOMATIC;

    it('blocks DM exceeding 1000 chars', () => {
      const dto: SafetyCheckDto = { ...base, content: 'a'.repeat(1001) };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('too long');
    });

    it('allows DM at exactly 1000 chars', () => {
      const dto: SafetyCheckDto = { ...base, content: 'a'.repeat(1_000) };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(true);
    });

    it('blocks comment reply exceeding 500 chars', () => {
      const dto: SafetyCheckDto = {
        ...base,
        action: SafetyAction.REPLY_COMMENT,
        content: 'a'.repeat(501),
      };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(false);
    });

    it('blocks multiple external links', () => {
      const dto: SafetyCheckDto = {
        ...base,
        content: 'Visita https://a.com y también https://b.com',
      };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('links');
    });

    it('allows a single external link', () => {
      const dto: SafetyCheckDto = {
        ...base,
        content: 'Agende en https://example.com',
      };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(true);
    });

    it('blocks prohibited promotional phrases', () => {
      const dto: SafetyCheckDto = {
        ...base,
        content: 'Haz clic ahora para obtener tu descuento especial',
      };
      const result = service.check(dto, mode, false);
      expect(result.passed).toBe(false);
      expect(result.violations[0]).toContain('Prohibited');
    });
  });
});
