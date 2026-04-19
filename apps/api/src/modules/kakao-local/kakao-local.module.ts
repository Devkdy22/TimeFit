import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { KakaoLocalController } from './kakao-local.controller';
import { KakaoLocalService } from './kakao-local.service';
import { LocationService } from './location.service';

@Module({
  controllers: [KakaoLocalController],
  providers: [KakaoLocalService, LocationService, AppConfigService, SafeLogger],
  exports: [KakaoLocalService, LocationService],
})
export class KakaoLocalModule {}
