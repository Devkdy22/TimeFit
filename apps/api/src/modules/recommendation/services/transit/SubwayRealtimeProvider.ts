import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import { SeoulSubwayClient } from '../../integrations/seoul-subway.client';
import type { MobilitySegment } from '../../types/recommendation.types';

@Injectable()
export class SubwayRealtimeProvider {
  private readonly cache = new Map<string, { expiresAt: number; value: MobilitySegment }>();
  private readonly ttlMs = 15_000;
  private readonly staleMaxMs = 10 * 60_000;
  private readonly seoulLineKeywords = [
    '1호선',
    '2호선',
    '3호선',
    '4호선',
    '5호선',
    '6호선',
    '7호선',
    '8호선',
    '9호선',
    '신분당선',
    '수인분당선',
    '경의중앙선',
    '공항철도',
    '경춘선',
    '경강선',
    '우이신설선',
    '신림선',
  ];
  private readonly nonSeoulKeywords = ['부산', '대구', '광주', '대전', '동해선', '김해경전철'];

  constructor(
    private readonly seoulSubwayClient: SeoulSubwayClient,
    private readonly logger: SafeLogger,
  ) {}

  async patchSegment(segment: MobilitySegment): Promise<MobilitySegment> {
    if (segment.mode !== 'subway') {
      return segment;
    }

    const startStationName = this.normalizeStationName(segment.startName);
    const endStationName = this.normalizeStationName(segment.endName);
    const stationName = startStationName || endStationName;
    const lineLabel = this.normalizeLineLabel(segment.lineLabel);
    const cacheKey = `${stationName}:${lineLabel}`;
    this.logger.log(
      {
        event: 'transit.realtime.subway.segment_input',
        lineLabel: segment.lineLabel ?? null,
        normalizedLineLabel: lineLabel || null,
        startName: segment.startName ?? null,
        endName: segment.endName ?? null,
        startStationName: startStationName || null,
        endStationName: endStationName || null,
      },
      SubwayRealtimeProvider.name,
    );
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (!stationName || !this.isSeoulSupportedLine(lineLabel)) {
      const reasonCode = !stationName ? 'SUBWAY_STATION_NOT_MATCHED' : 'SUBWAY_LINE_NOT_SUPPORTED';
      return {
        ...segment,
        realtimeAdjustedDurationMinutes: segment.durationMinutes,
        delayMinutes: 0,
        realtimeStatus: 'UNAVAILABLE',
        realtimeInfo: {
          matchingConfidence: 0.2,
          source: 'CACHE',
          reasonCode,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    try {
      this.logger.log(
        {
          event: 'transit.realtime.subway.lookup.try',
          stationName,
          lineLabel: lineLabel || null,
        },
        SubwayRealtimeProvider.name,
      );
      let arrival = await this.seoulSubwayClient.getSubwayArrival(stationName, lineLabel);
      if (
        arrival.source !== 'api' &&
        startStationName &&
        endStationName &&
        startStationName !== endStationName
      ) {
        const fallbackStation = stationName === startStationName ? endStationName : startStationName;
        this.logger.log(
          {
            event: 'transit.realtime.subway.lookup.fallback_try',
            stationName: fallbackStation,
            lineLabel: lineLabel || null,
          },
          SubwayRealtimeProvider.name,
        );
        const fallbackArrival = await this.seoulSubwayClient.getSubwayArrival(fallbackStation, lineLabel);
        if (fallbackArrival.source === 'api') {
          arrival = fallbackArrival;
        }
      }
      const hasPublicRealtime = arrival.source === 'api';
      const etaSeconds = hasPublicRealtime ? (this.parseArrivalSeconds(arrival.arrivalMessage) ?? 60) : undefined;
      const etaMinutes = typeof etaSeconds === 'number' ? Number((etaSeconds / 60).toFixed(2)) : undefined;
      const realtimeCandidates = hasPublicRealtime
        ? await this.seoulSubwayClient.getSubwayArrivalCandidates(stationName, lineLabel)
        : [];
      const firstDirectionalCandidate = realtimeCandidates.find(
        (candidate) => (candidate.direction ?? '').trim().length > 0,
      );
      const delayMinutes = etaMinutes !== undefined ? Math.max(0, etaMinutes - 2) : 0;
      const adjusted = Math.max(segment.durationMinutes, segment.durationMinutes + delayMinutes);
      const matchingConfidence = lineLabel ? 0.85 : 0.65;

      const patched: MobilitySegment = {
        ...segment,
        directionLabel: segment.directionLabel ?? firstDirectionalCandidate?.direction,
        realtimeAdjustedDurationMinutes: adjusted,
        delayMinutes,
        realtimeStatus: hasPublicRealtime ? (delayMinutes >= 3 ? 'DELAYED' : 'LIVE') : 'UNAVAILABLE',
        realtimeInfo: {
          etaMinutes,
          etaSeconds,
          trainStatusMessage: arrival.arrivalMessage,
          matchingConfidence,
          source: hasPublicRealtime ? 'SEOUL_API' : 'CACHE',
          reasonCode: hasPublicRealtime ? undefined : 'SUBWAY_EMPTY_RESPONSE',
          updatedAt: new Date().toISOString(),
        },
        candidates: (() => {
          const normalizeRoute = (value: string) => value.replace(/\s+/g, '').toUpperCase();
          const map = new Map<string, { route: string; etaMinutes: number; etaSeconds?: number; direction?: string }>();
          realtimeCandidates
            .map((candidate) => ({
              route: candidate.route,
              direction: candidate.direction,
              etaMinutes: candidate.etaMinutes,
              etaSeconds: candidate.etaSeconds,
            }))
            .filter((candidate) => (candidate.etaSeconds ?? 0) > 0)
            .forEach((candidate) => {
              const key = `${normalizeRoute(candidate.route)}::${(candidate.direction ?? '').trim()}`;
              const existing = map.get(key);
              if (!existing || (existing.etaSeconds ?? 999999) > (candidate.etaSeconds ?? 999999)) {
                map.set(key, candidate);
              }
            });

          if (typeof etaMinutes === 'number' && typeof etaSeconds === 'number' && etaSeconds > 0) {
            map.set(`${normalizeRoute(segment.lineLabel?.trim() || '지하철')}::PRIMARY`, {
              route: segment.lineLabel?.trim() || '지하철',
              direction: undefined,
              etaMinutes,
              etaSeconds,
            });
          }

          return Array.from(map.values())
            .filter((candidate) => (candidate.etaSeconds ?? 0) > 0)
            .sort((a, b) => (a.etaSeconds ?? 999999) - (b.etaSeconds ?? 999999))
            .slice(0, 6);
        })(),
      };

      this.logger.log(
        {
          event: 'transit.realtime.subway.patched',
          stationName,
          lineLabel,
          etaMinutes,
          delayMinutes,
          matchingConfidence,
        },
        SubwayRealtimeProvider.name,
      );

      this.cache.set(cacheKey, {
        expiresAt: Date.now() + this.ttlMs,
        value: patched,
      });

      return patched;
    } catch (error) {
      this.logger.warn(
        {
          event: 'transit.realtime.subway.failed',
          reason: error instanceof Error ? error.message : 'unknown_error',
          stationName,
          lineLabel,
        },
        SubwayRealtimeProvider.name,
      );

      if (cached && cached.expiresAt + this.staleMaxMs > Date.now()) {
        return {
          ...cached.value,
          realtimeStatus: 'STALE',
          realtimeInfo: {
            ...cached.value.realtimeInfo,
            source: 'CACHE',
            reasonCode: 'CACHE_STALE_USED',
            updatedAt: new Date().toISOString(),
          },
        };
      }

      return {
        ...segment,
        realtimeAdjustedDurationMinutes: segment.durationMinutes,
        delayMinutes: 0,
        realtimeStatus: 'CHECKING',
        realtimeInfo: {
          matchingConfidence: 0.2,
          source: 'CACHE',
          reasonCode: 'SUBWAY_API_TIMEOUT',
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }

  private parseArrivalMinutes(message: string): number | null {
    const seconds = this.parseArrivalSeconds(message);
    if (seconds === null) {
      return null;
    }
    return Number((seconds / 60).toFixed(2));
  }

  private parseArrivalSeconds(message: string): number | null {
    const normalized = message.replace(/\s+/g, ' ').trim();

    const minSec = normalized.match(/(\d+)분\s*(\d*)초/);
    if (minSec?.[1]) {
      const minutes = Number(minSec[1]);
      const seconds = Number(minSec[2] ?? 0);
      if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
        return Math.max(10, minutes * 60 + seconds);
      }
    }

    const minOnly = normalized.match(/(\d+)분/);
    if (minOnly?.[1]) {
      const minutes = Number(minOnly[1]);
      if (Number.isFinite(minutes)) {
        return Math.max(10, minutes * 60);
      }
    }

    const secOnly = normalized.match(/(\d+)초/);
    if (secOnly?.[1]) {
      const seconds = Number(secOnly[1]);
      if (Number.isFinite(seconds)) {
        return Math.max(10, seconds);
      }
    }

    if (normalized.includes('곧 도착') || normalized.includes('진입')) {
      return 30;
    }

    return null;
  }

  private normalizeStationName(name: string | undefined): string {
    return (name ?? '').trim().replace(/역$/, '');
  }

  private normalizeLineLabel(label: string | undefined): string {
    return (label ?? '').trim();
  }

  private isSeoulSupportedLine(lineLabel: string): boolean {
    if (!lineLabel) {
      return true;
    }

    if (this.nonSeoulKeywords.some((keyword) => lineLabel.includes(keyword))) {
      return false;
    }

    return this.seoulLineKeywords.some((keyword) => lineLabel.includes(keyword));
  }
}
