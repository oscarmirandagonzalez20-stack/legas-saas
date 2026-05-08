import { Module } from '@nestjs/common';
import { CryptoModule } from '@/common/crypto/crypto.module';
import { TenantContextModule } from '@/common/tenant-context/tenant-context.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MetaOAuthModule } from '../meta-oauth/meta-oauth.module';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  imports: [PrismaModule, CryptoModule, TenantContextModule, MetaOAuthModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}
