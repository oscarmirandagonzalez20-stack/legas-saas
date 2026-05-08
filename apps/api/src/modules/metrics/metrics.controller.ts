import { Controller, Get, Header, HttpCode } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Exposes Prometheus-format metrics at GET /metrics.
 *
 * SECURITY: This endpoint must NOT be exposed on a public-facing port.
 * Protect it at the infrastructure level (private network, firewall rule, or
 * internal load-balancer routing). If public exposure becomes necessary,
 * add a bearer-token guard before enabling it.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(200)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
