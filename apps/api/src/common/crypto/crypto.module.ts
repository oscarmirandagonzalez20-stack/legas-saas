import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module';
import { CryptoService } from './crypto.service';

@Module({
  imports: [AppConfigModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
