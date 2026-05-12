import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { RedisModule } from '@/redis/redis.module';
import { SafetyService } from './safety.service';
import { MetaRateLimiterService } from './services/meta-rate-limiter.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HumanizationService } from './services/humanization.service';
import { AntiSpamService } from './services/anti-spam.service';
import { MetaComplianceService } from './services/meta-compliance.service';
import { ContentSafetyService } from './services/content-safety.service';
import { AccountProtectionService } from './services/account-protection.service';

@Global()
@Module({
  imports: [AppConfigModule, RedisModule],
  providers: [
    SafetyService,
    MetaRateLimiterService,
    CircuitBreakerService,
    HumanizationService,
    AntiSpamService,
    MetaComplianceService,
    ContentSafetyService,
    AccountProtectionService,
  ],
  exports: [
    SafetyService,
    MetaRateLimiterService,
    CircuitBreakerService,
    HumanizationService,
    AntiSpamService,
    MetaComplianceService,
    ContentSafetyService,
    AccountProtectionService,
  ],
})
export class SafetyModule {}
