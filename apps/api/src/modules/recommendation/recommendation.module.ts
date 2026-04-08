import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { MemoryTtlCacheService } from '../../common/cache/memory-ttl-cache.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { RecommendationController } from './recommendation.controller';
import { TrafficSnapshotRepository } from './cache/traffic-snapshot.repository';
import { KakaoMapClient } from './integrations/kakao-map.client';
import { TrafficClient } from './integrations/traffic.client';
import { WeatherClient } from './integrations/weather.client';
import { SeoulBusClient } from './integrations/seoul-bus.client';
import { SeoulSubwayClient } from './integrations/seoul-subway.client';
import { RecommendationService } from './services/recommendation.service';

@Module({
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    SafeLogger,
    AppConfigService,
    MemoryTtlCacheService,
    TrafficSnapshotRepository,
    KakaoMapClient,
    TrafficClient,
    WeatherClient,
    SeoulBusClient,
    SeoulSubwayClient,
  ],
  exports: [RecommendationService],
})
export class RecommendationModule {}
