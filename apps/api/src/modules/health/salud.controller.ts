import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Ultra-minimal Railway healthcheck probe.
 * Zero dependencies — no DB, no Redis, no BullMQ, no Prisma.
 * Must remain alive even if every other subsystem is down.
 */
@SkipThrottle()
@Controller('salud')
export class SaludController {
  @Get()
  check(): { ok: boolean } {
    return { ok: true };
  }
}
