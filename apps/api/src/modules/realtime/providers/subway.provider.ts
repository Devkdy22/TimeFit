import { Injectable } from '@nestjs/common';
import { SeoulSubwayClient } from '../../recommendation/integrations/seoul-subway.client';
import { SubwayStationMatcher } from '../matchers/subway-station.matcher';
import type { RealtimeEtaResponse, SubwayEtaQuery } from '../realtime.types';

function parseMinutes(message: string): number | null {
  const normalized = message.replace(/\s+/g, ' ').trim();
  const minSec = normalized.match(/(\d+)분\s*(\d*)초/);
  if (minSec?.[1]) {
    const minutes = Number(minSec[1]);
    const seconds = Number(minSec[2] ?? 0);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.max(1, Math.round(minutes + seconds / 60));
    }
  }
  const minOnly = normalized.match(/(\d+)분/);
  if (minOnly?.[1]) {
    return Math.max(1, Number(minOnly[1]));
  }
  const secOnly = normalized.match(/(\d+)초/);
  if (secOnly?.[1]) {
    return Math.max(1, Math.round(Number(secOnly[1]) / 60));
  }
  if (normalized.includes('진입') || normalized.includes('곧 도착')) {
    return 1;
  }
  return null;
}

@Injectable()
export class SubwayProvider {
  constructor(
    private readonly matcher: SubwayStationMatcher,
    private readonly seoulSubwayClient: SeoulSubwayClient,
  ) {}

  async getEta(input: SubwayEtaQuery): Promise<RealtimeEtaResponse> {
    const now = new Date().toISOString();
    const line = this.matcher.resolveLine(input.line);
    const station = this.matcher.resolveStation(input.station);

    if (!station) {
      return {
        type: 'SUBWAY',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: 'SUBWAY_STATION_NOT_MATCHED',
        updatedAt: now,
      };
    }

    if (!this.matcher.isSupportedLine(line)) {
      return {
        type: 'SUBWAY',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: 'SUBWAY_LINE_NOT_SUPPORTED',
        updatedAt: now,
      };
    }

    try {
      const result = await this.seoulSubwayClient.getSubwayArrival(station, line ?? undefined);
      if (result.source !== 'api') {
        return {
          type: 'SUBWAY',
          status: 'UNAVAILABLE',
          etaMinutes: null,
          source: 'SEOUL_API',
          reasonCode: 'SUBWAY_EMPTY_RESPONSE',
          updatedAt: now,
        };
      }

      const etaMinutes = parseMinutes(result.arrivalMessage);
      if (etaMinutes === null) {
        return {
          type: 'SUBWAY',
          status: 'UNAVAILABLE',
          etaMinutes: null,
          source: 'SEOUL_API',
          reasonCode: 'SUBWAY_EMPTY_RESPONSE',
          updatedAt: now,
        };
      }

      return {
        type: 'SUBWAY',
        status: etaMinutes > 6 ? 'DELAYED' : 'LIVE',
        etaMinutes,
        source: 'SEOUL_API',
        reasonCode: null,
        updatedAt: now,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      return {
        type: 'SUBWAY',
        status: 'UNAVAILABLE',
        etaMinutes: null,
        source: 'SEOUL_API',
        reasonCode: message.includes('timeout') ? 'SUBWAY_API_TIMEOUT' : 'SUBWAY_EMPTY_RESPONSE',
        updatedAt: now,
      };
    }
  }
}
