import { Injectable } from '@nestjs/common';
import { SeoulBusClient } from '../../recommendation/integrations/seoul-bus.client';
import { BusStopMatcher } from '../matchers/bus-stop.matcher';
import type { BusEtaQuery, RealtimeEtaResponse } from '../realtime.types';

@Injectable()
export class BusProvider {
  constructor(
    private readonly matcher: BusStopMatcher,
    private readonly seoulBusClient: SeoulBusClient,
  ) {}

  async getEta(input: BusEtaQuery): Promise<RealtimeEtaResponse> {
    const matched = await this.matcher.resolve(input);
    const now = new Date().toISOString();

    if (!matched.stationId && !matched.arsId) {
      return {
        type: 'BUS',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: 'BUS_STOP_NOT_MATCHED',
        updatedAt: now,
      };
    }

    if (!matched.routeId && !matched.routeNo) {
      return {
        type: 'BUS',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: 'BUS_ROUTE_NOT_FOUND',
        updatedAt: now,
      };
    }

    try {
      const result = matched.stationId
        ? await this.seoulBusClient.getArrival(matched.stationId, matched.routeId)
        : await this.seoulBusClient.getArrivalByArsId(matched.arsId!, matched.routeNo);

      if (!result || result.source !== 'api') {
        return {
          type: 'BUS',
          status: 'UNAVAILABLE',
          etaMinutes: null,
          source: 'SEOUL_API',
          reasonCode: 'BUS_EMPTY_RESPONSE',
          updatedAt: now,
        };
      }

      const etaMinutes = Math.max(1, Math.round(result.arrivalSec / 60));
      return {
        type: 'BUS',
        status: etaMinutes > 6 ? 'DELAYED' : 'LIVE',
        etaMinutes,
        source: 'SEOUL_API',
        reasonCode: null,
        updatedAt: now,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      return {
        type: 'BUS',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: message.includes('timeout') ? 'BUS_API_TIMEOUT' : 'BUS_EMPTY_RESPONSE',
        updatedAt: now,
      };
    }
  }
}

