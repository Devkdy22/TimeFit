import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { AppConfigService } from '../../common/config/app-config.service';
import { SeoulBusClient } from '../recommendation/integrations/seoul-bus.client';
import { SeoulSubwayClient } from '../recommendation/integrations/seoul-subway.client';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { BusProvider } from './providers/bus.provider';
import { SubwayProvider } from './providers/subway.provider';
import { BusStopMatcher } from './matchers/bus-stop.matcher';
import { SubwayStationMatcher } from './matchers/subway-station.matcher';
import { RealtimeCacheService } from './cache/realtime-cache.service';
import { EtaFallbackStrategy } from './strategies/eta-fallback.strategy';
import { RealtimeLogger } from './logs/realtime.logger';

@Module({
  controllers: [RealtimeController],
  providers: [
    RealtimeService,
    RealtimeCacheService,
    BusProvider,
    SubwayProvider,
    BusStopMatcher,
    SubwayStationMatcher,
    EtaFallbackStrategy,
    RealtimeLogger,
    SafeLogger,
    AppConfigService,
    SeoulBusClient,
    SeoulSubwayClient,
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}

