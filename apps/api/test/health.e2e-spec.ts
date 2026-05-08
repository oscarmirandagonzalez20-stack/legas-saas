import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/create-test-app';

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status ok when DB and Redis are reachable', async () => {
      const response = await request.get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('GET /health/live', () => {
    it('returns 200 with status ok', async () => {
      const response = await request.get('/health/live');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when DB and Redis are reachable', async () => {
      const response = await request.get('/health/ready');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('x-request-id header', () => {
    it('echoes back the provided request ID', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request.get('/health/live').set('x-request-id', id);
      expect(response.headers['x-request-id']).toBe(id);
    });

    it('generates a request ID when none is provided', async () => {
      const response = await request.get('/health/live');
      expect(response.headers['x-request-id']).toBeTruthy();
    });
  });
});
