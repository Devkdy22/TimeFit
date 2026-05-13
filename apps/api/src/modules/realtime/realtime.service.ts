import { Injectable } from '@nestjs/common';
import { RealtimeCacheService } from './cache/realtime-cache.service';
import { RealtimeLogger } from './logs/realtime.logger';
import { BusProvider } from './providers/bus.provider';
import { SubwayProvider } from './providers/subway.provider';
import { EtaFallbackStrategy } from './strategies/eta-fallback.strategy';
import type { BusEtaQuery, RealtimeEtaResponse, SubwayEtaQuery } from './realtime.types';

@Injectable()
export class RealtimeService {
  constructor(
    private readonly cache: RealtimeCacheService,
    private readonly logger: RealtimeLogger,
    private readonly busProvider: BusProvider,
    private readonly subwayProvider: SubwayProvider,
    private readonly fallbackStrategy: EtaFallbackStrategy,
  ) {}

  getBusEta(query: BusEtaQuery): Promise<RealtimeEtaResponse> {
    const key = `BUS:${query.stationId ?? ''}:${query.routeId ?? ''}:${query.arsId ?? ''}:${query.routeNo ?? ''}`;
    return this.cache.withInFlight(key, async () => {
      const start = Date.now();
      const fresh = this.cache.getFresh(key);
      if (fresh) {
        this.logger.logResult('BUS', fresh, Date.now() - start);
        return fresh;
      }

      const live = await this.busProvider.getEta(query);
      if (live.status === 'LIVE' || live.status === 'DELAYED') {
        this.cache.setSuccess(key, live);
        this.logger.logResult('BUS', live, Date.now() - start);
        return live;
      }

      const failureCount = this.cache.markFailure(key);
      const fallback = this.fallbackStrategy.apply({
        type: 'BUS',
        stale: this.cache.getStale(key),
        failureCount,
        reasonCode: live.reasonCode ?? 'BUS_EMPTY_RESPONSE',
      });
      this.logger.logResult('BUS', fallback, Date.now() - start);
      return fallback;
    });
  }

  getSubwayEta(query: SubwayEtaQuery): Promise<RealtimeEtaResponse> {
    const key = `SUBWAY:${query.line}:${query.station}`;
    return this.cache.withInFlight(key, async () => {
      const start = Date.now();
      const fresh = this.cache.getFresh(key);
      if (fresh) {
        this.logger.logResult('SUBWAY', fresh, Date.now() - start);
        return fresh;
      }

      const live = await this.subwayProvider.getEta(query);
      if (live.status === 'LIVE' || live.status === 'DELAYED') {
        this.cache.setSuccess(key, live);
        this.logger.logResult('SUBWAY', live, Date.now() - start);
        return live;
      }

      const failureCount = this.cache.markFailure(key);
      const fallback = this.fallbackStrategy.apply({
        type: 'SUBWAY',
        stale: this.cache.getStale(key),
        failureCount,
        reasonCode: live.reasonCode ?? 'SUBWAY_EMPTY_RESPONSE',
      });
      this.logger.logResult('SUBWAY', fallback, Date.now() - start);
      return fallback;
    });
  }
}

