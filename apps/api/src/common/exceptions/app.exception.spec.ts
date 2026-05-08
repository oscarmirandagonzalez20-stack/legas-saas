import { describe, expect, it } from 'vitest';
import { AppException, DomainException, InfrastructureException } from './app.exception';

describe('AppException', () => {
  it('sets statusCode, errorCode, and message', () => {
    const err = new AppException(400, 'BAD_INPUT', 'bad input');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('BAD_INPUT');
    expect(err.message).toBe('bad input');
  });

  it('is an instance of Error', () => {
    expect(new AppException(500, 'E', 'msg')).toBeInstanceOf(Error);
  });

  it('name reflects the class name', () => {
    expect(new AppException(500, 'E', 'msg').name).toBe('AppException');
  });
});

describe('DomainException', () => {
  it('uses statusCode 422', () => {
    const err = new DomainException('LEAD_NOT_FOUND', 'Lead no encontrado');
    expect(err.statusCode).toBe(422);
    expect(err.errorCode).toBe('LEAD_NOT_FOUND');
  });

  it('is an instance of AppException', () => {
    expect(new DomainException('E', 'msg')).toBeInstanceOf(AppException);
  });
});

describe('InfrastructureException', () => {
  it('uses statusCode 503', () => {
    const err = new InfrastructureException('DB_UNAVAILABLE', 'Base de datos no disponible');
    expect(err.statusCode).toBe(503);
    expect(err.errorCode).toBe('DB_UNAVAILABLE');
  });

  it('is an instance of AppException', () => {
    expect(new InfrastructureException('E', 'msg')).toBeInstanceOf(AppException);
  });
});
