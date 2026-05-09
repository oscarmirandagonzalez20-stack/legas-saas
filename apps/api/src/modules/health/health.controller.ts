import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import { QueueHealthIndicator } from './indicators/queue-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly queueIndicator: QueueHealthIndicator,
  ) {}

  /** Railway healthcheck — plain 200 OK, no dependency checks */
  @Get()
  healthcheck(): { status: string } {
    return { status: 'ok' };
  }

  /** Liveness: is the process alive and accepting requests? */
  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: can the process handle real traffic? */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.queueIndicator.isHealthy('queue'),
    ]);
  }
}
