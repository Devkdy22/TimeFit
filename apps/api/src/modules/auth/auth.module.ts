import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { AuthAccessGuard } from './auth-access.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthAccessGuard, SafeLogger, AppConfigService],
  exports: [AuthService, AuthAccessGuard],
})
export class AuthModule {}
