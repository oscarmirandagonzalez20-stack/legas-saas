import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const userSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

const pipe = new ZodValidationPipe(userSchema);
const metadata = { type: 'body' as const, metatype: Object, data: '' };

describe('ZodValidationPipe', () => {
  it('returns the parsed value on valid input', () => {
    const result = pipe.transform({ name: 'Óscar', age: 40 }, metadata);
    expect(result).toEqual({ name: 'Óscar', age: 40 });
  });

  it('throws BadRequestException on invalid input', () => {
    expect(() => pipe.transform({ name: '', age: -1 }, metadata)).toThrow(
      BadRequestException,
    );
  });

  it('includes errorCode VALIDATION_ERROR in the exception', () => {
    try {
      pipe.transform({ name: '' }, metadata);
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as { errorCode: string };
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    }
  });

  it('includes flattened Zod errors in the exception body', () => {
    try {
      pipe.transform({ name: '', age: 'not-a-number' }, metadata);
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { errors: unknown };
      expect(body.errors).toBeDefined();
    }
  });

  it('coerces via schema transformations', () => {
    const numSchema = z.object({ value: z.coerce.number() });
    const numPipe = new ZodValidationPipe(numSchema);
    expect(numPipe.transform({ value: '42' }, metadata)).toEqual({ value: 42 });
  });
});
