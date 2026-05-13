import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { MemoryTtlCacheService } from '../../common/cache/memory-ttl-cache.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { RecommendationController } from './recommendation.controller';
import { TrafficSnapshotRepository } from './cache/traffic-snapshot.repository';
import { OdsayUsageRepository } from './cache/odsay-usage.repository';
import { KakaoMapClient } from './integrations/kakao-map.client';
import { TrafficClient } from './integrations/traffic.client';
import { WeatherClient } from './integrations/weather.client';
import { SeoulBusClient } from './integrations/seoul-bus.client';
import { SeoulSubwayClient } from './integrations/seoul-subway.client';
import { RecommendationService } from './services/recommendation.service';
import { OdsayTransitClient } from './services/transit/OdsayTransitClient';
import { BusRealtimeProvider } from './services/transit/BusRealtimeProvider';
import { SubwayRealtimeProvider } from './services/transit/SubwayRealtimeProvider';
import { TransitRealtimeOrchestrator } from './services/transit/TransitRealtimeOrchestrator';
import { ReRoutingEngine } from './services/transit/ReRoutingEngine';
import { RealtimeUpdateScheduler } from './services/transit/RealtimeUpdateScheduler';
import { TimeFitNotifier } from './services/notification/TimeFitNotifier';
import { RealtimeBusModule } from '../realtime-bus/realtime-bus.module';

@Module({
  imports: [RealtimeBusModule],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    SafeLogger,
    AppConfigService,
    MemoryTtlCacheService,
    TrafficSnapshotRepository,
    OdsayUsageRepository,
    KakaoMapClient,
    TrafficClient,
    WeatherClient,
    SeoulBusClient,
    SeoulSubwayClient,
    OdsayTransitClient,
    BusRealtimeProvider,
    SubwayRealtimeProvider,
    TransitRealtimeOrchestrator,
    ReRoutingEngine,
    RealtimeUpdateScheduler,
    TimeFitNotifier,
  ],
  exports: [
    RecommendationService,
    KakaoMapClient,
    ReRoutingEngine,
    RealtimeUpdateScheduler,
    TimeFitNotifier,
  ],
})
export class RecommendationModule {}
