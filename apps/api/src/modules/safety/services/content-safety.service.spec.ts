import { describe, it, expect } from 'vitest';
import { ContentSafetyService } from './content-safety.service';

describe('ContentSafetyService', () => {
  const service = new ContentSafetyService();

  describe('safe content', () => {
    it('passes clean legal service message', () => {
      const result = service.check(
        'Buenos días, soy abogado especialista en derecho familiar. ' +
        'Este mensaje es informativo y no constituye asesoría legal. ' +
        '¿En qué le puedo ayudar?',
      );
      expect(result.safe).toBe(true);
      expect(result.severity).toBe('LOW');
    });

    it('passes message with a single link', () => {
      const result = service.check('Puede agendar su consulta en https://example.com/agenda');
      expect(result.safe).toBe(true);
    });
  });

  describe('HIGH severity — blocked', () => {
    it('blocks message with 3+ external links', () => {
      const result = service.check(
        'Visita https://a.com y https://b.com y también https://c.com',
      );
      expect(result.safe).toBe(false);
      expect(result.severity).toBe('HIGH');
      expect(result.issues.some((i) => i.includes('links'))).toBe(true);
    });

    it('blocks spam keywords (MLM)', () => {
      const result = service.check('Únete a nuestro negocio de multinivel y gana dinero rápido');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe('HIGH');
    });

    it('blocks promotional spam keywords', () => {
      const result = service.check('¡Compra ahora y obtén 100% gratis!');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe('HIGH');
    });
  });

  describe('MEDIUM severity — may pass depending on caller policy', () => {
    it('flags all-caps messages', () => {
      const result = service.check('ESTE DESPACHO OFRECE LOS MEJORES SERVICIOS LEGALES PARA USTED');
      expect(result.issues.some((i) => i.includes('uppercase'))).toBe(true);
      expect(result.severity).toBe('MEDIUM');
    });

    it('flags repetitive characters', () => {
      const result = service.check('¡¡¡¡¡¡¡¡¡Oferta!!!!!!!!!');
      expect(result.issues.some((i) => i.includes('Repetitive'))).toBe(true);
    });

    it('flags phone number (off-platform redirect risk)', () => {
      const result = service.check('Llámenos al 55 1234 5678 para más información');
      expect(result.issues.some((i) => i.includes('Phone'))).toBe(true);
    });
  });

  describe('advisory warnings', () => {
    it('warns when long message lacks legal disclaimer', () => {
      const longMsg = 'a'.repeat(201);
      const result = service.check(longMsg);
      expect(result.issues.some((i) => i.includes('disclaimer'))).toBe(true);
      expect(result.safe).toBe(true); // warning only
    });

    it('does not warn on short messages without disclaimer', () => {
      const result = service.check('Hola, ¿en qué le puedo ayudar?');
      expect(result.issues.some((i) => i.includes('disclaimer'))).toBe(false);
    });
  });
});
