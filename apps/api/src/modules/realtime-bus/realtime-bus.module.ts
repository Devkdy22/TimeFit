import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { EtaCacheService } from './cache/eta-cache.service';
import { MappingCacheService } from './cache/mapping-cache.service';
import { RealtimeBusLogger } from './logs/realtime-bus.logger';
import { RouteNameMatcher } from './matchers/route-name.matcher';
import { StationMatcher } from './matchers/station.matcher';
import { GyeonggiBusProvider } from './providers/gyeonggi-bus.provider';
import { IncheonBusProvider } from './providers/incheon-bus.provider';
import { SeoulBusProvider } from './providers/seoul-bus.provider';
import { BusIdentityResolver } from './resolver/bus-identity.resolver';
import { CandidateScorer } from './scoring/candidate.scorer';
import { RealtimeBusService } from './realtime-bus.service';
import { SeoulBusClient } from '../recommendation/integrations/seoul-bus.client';

@Module({
  providers: [
    AppConfigService,
    SafeLogger,
    RouteNameMatcher,
    StationMatcher,
    CandidateScorer,
    MappingCacheService,
    EtaCacheService,
    RealtimeBusLogger,
    SeoulBusClient,
    SeoulBusProvider,
    GyeonggiBusProvider,
    IncheonBusProvider,
    BusIdentityResolver,
    RealtimeBusService,
  ],
  exports: [RealtimeBusService],
})
export class RealtimeBusModule {}
