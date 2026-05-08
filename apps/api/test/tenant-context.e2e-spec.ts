import 'reflect-metadata';
import { Controller, Get, Module, UseGuards, UseInterceptors } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DevTenantGuard } from '@/common/tenant-context/dev-tenant.guard';
import { TenantContextInterceptor } from '@/common/tenant-context/tenant-context.interceptor';
import { TenantContextService } from '@/common/tenant-context/tenant-context.service';

@Controller('__test__')
class TenantTestController {
  constructor(private readonly svc: TenantContextService) {}

  @Get('tenant')
  @UseGuards(DevTenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  getTenant(): { tenantId: string | undefined } {
    return { tenantId: this.svc.getTenantId() };
  }

  @Get('public')
  getPublic(): { tenantId: string | undefined } {
    return { tenantId: this.svc.getTenantId() };
  }
}

@Module({
  controllers: [TenantTestController],
  providers: [TenantContextService, TenantContextInterceptor, DevTenantGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class TenantContextE2eModule {}

describe('TenantContext HTTP boundary (e2e)', () => {
  let app: NestFastifyApplication;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TenantContextE2eModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    request = supertest(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /__test__/tenant — protected endpoint', () => {
    const TENANT_ID = 'a1b2c3d4-1234-4abc-89ef-000000000001';

    it('returns 200 and the tenantId when x-tenant-id is a valid UUID', async () => {
      const res = await request.get('/__test__/tenant').set('x-tenant-id', TENANT_ID);
      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(TENANT_ID);
    });

    it('returns 401 when x-tenant-id header is absent', async () => {
      const res = await request.get('/__test__/tenant');
      expect(res.status).toBe(401);
    });

    it('returns 401 when x-tenant-id is not a valid UUID', async () => {
      const res = await request.get('/__test__/tenant').set('x-tenant-id', 'not-a-uuid');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /__test__/public — no guard, no interceptor', () => {
    it('returns 200 with tenantId undefined (ALS has no context)', async () => {
      const res = await request.get('/__test__/public');
      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBeUndefined();
    });
  });

  describe('concurrent requests', () => {
    it('each request receives its own tenantId — no cross-request leak', async () => {
      const idA = 'aaaaaaaa-0000-0000-0000-000000000001';
      const idB = 'bbbbbbbb-0000-0000-0000-000000000002';
      const idC = 'cccccccc-0000-0000-0000-000000000003';

      const [resA, resB, resC] = await Promise.all([
        request.get('/__test__/tenant').set('x-tenant-id', idA),
        request.get('/__test__/tenant').set('x-tenant-id', idB),
        request.get('/__test__/tenant').set('x-tenant-id', idC),
      ]);

      expect(resA.body.tenantId).toBe(idA);
      expect(resB.body.tenantId).toBe(idB);
      expect(resC.body.tenantId).toBe(idC);
    });
  });
});
