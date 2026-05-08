import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { CryptoModule } from '@/common/crypto/crypto.module';
import { TenantContextModule } from '@/common/tenant-context/tenant-context.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MetaOAuthController } from './meta-oauth.controller';
import { MetaOAuthService } from './meta-oauth.service';

@Module({
  imports: [AppConfigModule, PrismaModule, CryptoModule, TenantContextModule],
  controllers: [MetaOAuthController],
  providers: [MetaOAuthService],
  exports: [MetaOAuthService],
})
export class MetaOAuthModule {}
