import { Injectable, Logger } from '@nestjs/common';
import type { ContentSafetyResult } from '../safety.types';

// Content safety rules — all pattern-based, no external calls.
// HIGH severity blocks the message; MEDIUM/LOW are warnings.

const SPAM_KEYWORDS = [
  'mlm', 'multinivel', 'pirámide', 'piramide',
  'gana dinero rápido', 'gana dinero rapido',
  'trabaja desde casa', 'ingresos extra garantizados',
  'negocio rentable sin riesgo', 'inversión segura',
  'inversion segura', 'sin riesgo 100%',
  'get rich quick', 'make money fast',
] as const;

const PROMOTIONAL_KEYWORDS = [
  'haz clic ahora', 'haz click ahora',
  'compra ahora', 'descuento especial',
  'oferta limitada', 'actúa ya', 'actua ya',
  '100% gratis', 'ganador', 'felicitaciones',
  'click here', 'buy now', 'limited offer',
  'act now', 'unsubscribe', 'opt-out',
] as const;

const MAX_LINKS_HIGH = 3;
const MAX_LINKS_MEDIUM = 2;
const UPPERCASE_RATIO_HIGH = 0.6;
const MIN_LENGTH_FOR_UPPERCASE_CHECK = 20;
const LEGAL_DISCLAIMER_MIN_LENGTH = 200;

// Severity priority — use plain number so TypeScript does not narrow the `sev`
// variable to a literal and trigger @typescript-eslint/no-unnecessary-condition.
const SEV_LOW = 0;
const SEV_MEDIUM = 1;
const SEV_HIGH = 2;

@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);

  check(content: string): ContentSafetyResult {
    const issues: string[] = [];
    let sev: number = SEV_LOW;
    const raise = (level: number): void => { if (level > sev) sev = level; };

    // ── 1. Excessive external links ────────────────────────────────────────────
    const links = content.match(/https?:\/\/[^\s]+/gi) ?? [];
    if (links.length >= MAX_LINKS_HIGH) {
      issues.push(`Excessive links: ${String(links.length)}`);
      raise(SEV_HIGH);
    } else if (links.length >= MAX_LINKS_MEDIUM) {
      issues.push(`Multiple links detected: ${String(links.length)}`);
      raise(SEV_MEDIUM);
    }

    // ── 2. ALL-CAPS detection ──────────────────────────────────────────────────
    const letters = content.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '');
    if (letters.length >= MIN_LENGTH_FOR_UPPERCASE_CHECK) {
      const upperCount = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
      const ratio = upperCount / letters.length;
      if (ratio > UPPERCASE_RATIO_HIGH) {
        issues.push(`Excessive uppercase: ${Math.round(ratio * 100).toString()}%`);
        raise(SEV_MEDIUM);
      }
    }

    // ── 3. Repetitive characters ───────────────────────────────────────────────
    if (/(.)\1{4,}/.test(content)) {
      issues.push('Repetitive characters detected (e.g. "!!!!!", "aaaaa")');
      raise(SEV_MEDIUM);
    }

    // ── 4. Spam keywords (HIGH) ────────────────────────────────────────────────
    const spamFound = this.findKeywords(content, SPAM_KEYWORDS);
    if (spamFound.length > 0) {
      issues.push(`Spam keywords: ${spamFound.join(', ')}`);
      raise(SEV_HIGH);
    }

    // ── 5. Promotional keywords (HIGH — aggressive spam, not appropriate for legal DMs) ─
    const promoFound = this.findKeywords(content, PROMOTIONAL_KEYWORDS);
    if (promoFound.length > 0) {
      issues.push(`Promotional keywords: ${promoFound.join(', ')}`);
      raise(SEV_HIGH);
    }

    // ── 6. Mexican phone number exfiltration ───────────────────────────────────
    const mxPhone = /(\+?52[\s.-]?)?(\(?\d{2,3}\)?[\s.-]?)(\d{4}[\s.-]?\d{4}|\d{3}[\s.-]?\d{2}[\s.-]?\d{2})/;
    if (mxPhone.test(content)) {
      issues.push('Phone number detected — potential off-platform redirect');
      raise(SEV_MEDIUM);
    }

    // ── 7. Legal disclaimer advisory (warn only — never blocks) ───────────────
    if (content.length >= LEGAL_DISCLAIMER_MIN_LENGTH && !this.hasLegalDisclaimer(content)) {
      issues.push('Advisory: long message is missing legal disclaimer');
    }

    const severity: ContentSafetyResult['severity'] =
      sev >= SEV_HIGH ? 'HIGH' : sev >= SEV_MEDIUM ? 'MEDIUM' : 'LOW';
    const safe = sev < SEV_HIGH;

    if (!safe) {
      this.logger.warn(`Content blocked (${severity}): ${issues.join('; ')}`);
    } else if (issues.length > 0) {
      this.logger.debug(`Content advisory (${severity}): ${issues.join('; ')}`);
    }

    return { safe, issues, severity };
  }

  private findKeywords(
    content: string,
    keywords: Readonly<readonly string[]>,
  ): string[] {
    const lower = content.toLowerCase();
    return keywords.filter((kw) => lower.includes(kw));
  }

  private hasLegalDisclaimer(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      lower.includes('no constituye asesoría legal') ||
      lower.includes('no constituye asesoria legal') ||
      lower.includes('informativo y no') ||
      lower.includes('consulte a un abogado')
    );
  }
}
