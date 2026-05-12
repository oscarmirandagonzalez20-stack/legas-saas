import { Injectable, Logger } from '@nestjs/common';

interface HumanizationConfig {
  minDelayMs: number;
  maxDelayMs: number;
}

@Injectable()
export class HumanizationService {
  private readonly logger = new Logger(HumanizationService.name);

  // Returns a random delay biased toward the lower end using a square-root
  // distribution — humans tend to respond sooner rather than later, but with
  // enough variance that patterns are not detectable.
  getDelay(config: HumanizationConfig): number {
    const { minDelayMs, maxDelayMs } = config;
    const rand = Math.random();
    const biased = Math.sqrt(rand); // sqrt skews toward 0 → short-to-mid delays more common
    return Math.round(minDelayMs + biased * (maxDelayMs - minDelayMs));
  }

  async sleep(config: HumanizationConfig): Promise<void> {
    const delay = this.getDelay(config);
    this.logger.debug(`Humanization delay: ${String(delay)}ms`);
    return new Promise((resolve) => { setTimeout(resolve, delay); });
  }

  isInstantResponse(lastResponseAt: number): boolean {
    return Date.now() - lastResponseAt < 5_000;
  }
}
