import { Injectable } from '@nestjs/common';
import { SeoulBusClient } from '../../recommendation/integrations/seoul-bus.client';
import { normalizeRouteName } from '../normalizers/route-name.normalizer';
import { normalizeStationName } from '../normalizers/station-name.normalizer';
import type { BusEtaQuery } from '../realtime.types';

@Injectable()
export class BusStopMatcher {
  constructor(private readonly seoulBusClient: SeoulBusClient) {}

  async resolve(input: BusEtaQuery): Promise<{ stationId?: string; arsId?: string; routeId?: string; routeNo?: string }> {
    const routeNo = normalizeRouteName(input.routeNo);

    if (input.stationId?.trim()) {
      return {
        stationId: input.stationId.trim(),
        routeId: input.routeId?.trim(),
        routeNo,
      };
    }

    if (input.arsId?.trim()) {
      return {
        arsId: input.arsId.trim(),
        routeId: input.routeId?.trim(),
        routeNo,
      };
    }

    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
      const nearest = await this.seoulBusClient.getNearestStation(input.lat, input.lng);
      if (nearest) {
        return {
          stationId: nearest.stationId,
          routeId: input.routeId?.trim(),
          routeNo,
        };
      }
    }

    const stationName = normalizeStationName(input.stationName);
    if (!stationName) {
      return {
        routeId: input.routeId?.trim(),
        routeNo,
      };
    }

    return {
      routeId: input.routeId?.trim(),
      routeNo,
    };
  }
}

