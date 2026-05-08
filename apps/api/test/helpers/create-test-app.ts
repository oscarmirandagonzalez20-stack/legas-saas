import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
        (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
    }),
    { logger: false },
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
