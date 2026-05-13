import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import type { MobilitySegment } from '../../types/recommendation.types';
import { RealtimeBusService } from '../../../realtime-bus/realtime-bus.service';
import { SeoulBusClient } from '../../integrations/seoul-bus.client';

@Injectable()
export class BusRealtimeProvider {
  private readonly routeStationsCache = new Map<string, Awaited<ReturnType<SeoulBusClient['getRouteStations']>>>();
  constructor(
    private readonly realtimeBusService: RealtimeBusService,
    private readonly logger: SafeLogger,
    private readonly seoulBusClient: SeoulBusClient,
  ) {}

  async patchSegment(segment: MobilitySegment): Promise<MobilitySegment> {
    if (segment.mode !== 'bus') {
      return segment;
    }

    const resolved = await this.realtimeBusService.resolveEta({
      lineLabel: segment.lineLabel,
      startArsId: segment.startArsId,
      startStationId: segment.startStationId,
      startName: segment.startName,
      startLat: segment.startLat,
      startLng: segment.startLng,
      busRouteId: segment.busRouteId,
    });
    this.logger.log(
      {
        event: 'recommendation.bus_realtime.resolved',
        lineLabel: segment.lineLabel ?? null,
        startName: segment.startName ?? null,
        startArsId: segment.startArsId ?? null,
        startStationId: segment.startStationId ?? null,
        busRouteId: segment.busRouteId ?? null,
        status: resolved.status,
        provider: resolved.provider ?? null,
        etaMinutes: resolved.etaMinutes ?? null,
        etaSeconds: resolved.etaSeconds ?? null,
        reasonCode: resolved.reasonCode ?? null,
        confidence: resolved.confidence,
        debug: resolved.debug ?? null,
      },
      BusRealtimeProvider.name,
    );

    const etaMinutes = resolved.etaMinutes;
    const delayMinutes = typeof etaMinutes === 'number' ? Math.max(0, etaMinutes - 2) : 0;
    const adjusted = Math.max(segment.durationMinutes, segment.durationMinutes + delayMinutes);
    const candidates = await this.buildCandidates(segment, resolved.etaSeconds, etaMinutes);
    const firstCandidate = candidates.find((candidate) => (candidate.etaSeconds ?? 0) > 0);
    const fallbackEtaSeconds =
      firstCandidate?.etaSeconds ??
      (typeof firstCandidate?.etaMinutes === 'number' ? Math.max(1, Math.round(firstCandidate.etaMinutes * 60)) : undefined);
    const fallbackEtaMinutes =
      typeof firstCandidate?.etaMinutes === 'number'
        ? firstCandidate.etaMinutes
        : typeof fallbackEtaSeconds === 'number'
          ? Number((fallbackEtaSeconds / 60).toFixed(2))
          : undefined;
    const effectiveEtaMinutes = typeof etaMinutes === 'number' ? etaMinutes : fallbackEtaMinutes;
    const effectiveEtaSeconds = typeof resolved.etaSeconds === 'number' ? resolved.etaSeconds : fallbackEtaSeconds;
    const effectiveStatus =
      (resolved.status === 'UNAVAILABLE' || resolved.status === 'CHECKING') && typeof effectiveEtaMinutes === 'number'
        ? 'LIVE'
        : resolved.status;
    const passStops = await this.buildPassStops(segment);

    return {
      ...segment,
      realtimeAdjustedDurationMinutes: adjusted,
      delayMinutes,
      realtimeStatus: effectiveStatus,
      realtimeInfo: {
        etaMinutes: effectiveEtaMinutes,
        etaSeconds: effectiveEtaSeconds,
        matchingConfidence: Number((resolved.confidence / 100).toFixed(2)),
        reasonCode: resolved.reasonCode,
        source:
          resolved.provider === 'SEOUL'
            ? 'SEOUL_API'
            : resolved.provider === 'GYEONGGI'
              ? 'GYEONGGI_API'
              : resolved.provider === 'INCHEON'
                ? 'INCHEON_API'
                : 'CACHE',
        updatedAt: resolved.updatedAt,
        debug: resolved.debug ?? undefined,
      },
      candidates,
      passStops: passStops.length > 0 ? passStops : segment.passStops,
    };
  }

  private async buildCandidates(
    segment: MobilitySegment,
    fallbackEtaSeconds?: number,
    fallbackEtaMinutes?: number,
  ): Promise<Array<{ route: string; etaMinutes: number; etaSeconds?: number; direction?: string }>> {
    const arsId = (segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const primaryRoute = segment.lineLabel?.trim() || '버스';
    const fallbackList =
      typeof fallbackEtaMinutes === 'number'
        ? [
            {
              route: primaryRoute,
              etaMinutes: Number(fallbackEtaMinutes.toFixed(2)),
              etaSeconds:
                typeof fallbackEtaSeconds === 'number'
                  ? Math.max(1, Math.round(fallbackEtaSeconds))
                  : Math.max(1, Math.round(fallbackEtaMinutes * 60)),
            },
          ]
        : [];
    const normalizeRoute = (value: string) => value.replace(/\s+/g, '').toUpperCase();

    if (!arsId) {
      return fallbackList;
    }

    const stationArrivals = await this.seoulBusClient.getArrivalByArsId(arsId);
    if (!stationArrivals) {
      return fallbackList;
    }

    const normalizeName = (value: string) =>
      value
        .replace(/\(.*?\)/g, '')
        .replace(/[\s.\-·,]/g, '')
        .trim();
    const endStationId = (segment.endStationId ?? '').trim();
    const endArsId = (segment.endArsId ?? '').replace(/[^0-9]/g, '');
    const endName = normalizeName(segment.endName ?? '');
    const startStationId = (segment.startStationId ?? '').trim();
    const startArsId = (segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const startName = normalizeName(segment.startName ?? '');

    const isValidRouteNo = (routeNo: string) => {
      if (!routeNo) return false;
      // Internal ids like 1234567 should not be shown to users.
      if (/^\d{6,}$/.test(routeNo)) return false;
      return true;
    };
    const arrivalItems = (stationArrivals.arrivalItems ?? [])
      .filter((item) => Number.isFinite(item.arrivalSec) && item.arrivalSec > 0)
      .sort((a, b) => a.arrivalSec - b.arrivalSec);

    const canReachEnd = async (routeId: string) => {
      if (!routeId) return false;
      const cached = this.routeStationsCache.get(routeId);
      const stations = cached ?? (await this.seoulBusClient.getRouteStations(routeId));
      if (!cached) {
        this.routeStationsCache.set(routeId, stations);
      }
      if (stations.length === 0) return false;
      const findIndex = (fn: (station: (typeof stations)[number]) => boolean) => stations.findIndex((s) => fn(s));
      let sIdx = findIndex((s) => !!startStationId && s.stationId === startStationId);
      if (sIdx < 0) sIdx = findIndex((s) => !!startArsId && (s.arsId ?? '').replace(/[^0-9]/g, '') === startArsId);
      if (sIdx < 0) sIdx = findIndex((s) => !!startName && normalizeName(s.stationName) === startName);
      if (sIdx < 0) sIdx = findIndex((s) => !!startName && (normalizeName(s.stationName).includes(startName) || startName.includes(normalizeName(s.stationName))));

      let eIdx = findIndex((s) => !!endStationId && s.stationId === endStationId);
      if (eIdx < 0) eIdx = findIndex((s) => !!endArsId && (s.arsId ?? '').replace(/[^0-9]/g, '') === endArsId);
      if (eIdx < 0) eIdx = findIndex((s) => !!endName && normalizeName(s.stationName) === endName);
      if (eIdx < 0) eIdx = findIndex((s) => !!endName && (normalizeName(s.stationName).includes(endName) || endName.includes(normalizeName(s.stationName))));

      if (sIdx < 0 || eIdx < 0) return false;
      return sIdx <= eIdx;
    };

    const filteredItems: Array<{ routeNo: string; routeId: string; arrivalSec: number }> = [];
    const collectedPerRoute = new Map<string, number>();
    for (const item of arrivalItems) {
      const routeNo = (item.routeNo ?? '').trim();
      if (!isValidRouteNo(routeNo)) {
        continue;
      }
      const routeKey = `${normalizeRoute(routeNo)}::${(item.routeId ?? '').trim()}`;
      const currentCount = collectedPerRoute.get(routeKey) ?? 0;
      if (currentCount >= 2) {
        continue;
      }
      // 실제 end 정류장까지 가는 노선만 통과
      // eslint-disable-next-line no-await-in-loop
      if (!(await canReachEnd(item.routeId))) {
        continue;
      }
      filteredItems.push({ routeNo, routeId: item.routeId, arrivalSec: item.arrivalSec });
      collectedPerRoute.set(routeKey, currentCount + 1);
      // 노선 다양성을 위해 총량 상한만 제한한다.
      if (filteredItems.length >= 14) {
        break;
      }
    }

    const normalizedPrimaryRouteNo = normalizeRoute(segment.lineLabel?.trim() ?? '');
    const normalizedPrimaryRouteId = normalizeRoute(segment.busRouteId?.trim() ?? '');
    const primaryItems = arrivalItems
      .filter((item) => {
        const itemRouteNo = normalizeRoute((item.routeNo ?? '').trim());
        const itemRouteId = normalizeRoute((item.routeId ?? '').trim());
        if (normalizedPrimaryRouteNo && itemRouteNo === normalizedPrimaryRouteNo) {
          return true;
        }
        if (normalizedPrimaryRouteId && itemRouteId === normalizedPrimaryRouteId) {
          return true;
        }
        return false;
      })
      .slice(0, 2);
    for (const item of primaryItems) {
      const routeNo = (item.routeNo ?? '').trim() || (segment.lineLabel ?? '').trim() || '버스';
      const routeId = (item.routeId ?? '').trim() || (segment.busRouteId ?? '').trim();
      if (!isValidRouteNo(routeNo)) {
        continue;
      }
      filteredItems.push({ routeNo, routeId, arrivalSec: item.arrivalSec });
    }

    const candidatePool: Array<{ route: string; etaMinutes: number; etaSeconds?: number; direction?: string }> = [];
    const routeBuckets = new Map<string, Array<{ route: string; etaMinutes: number; etaSeconds?: number; direction?: string }>>();
    filteredItems.forEach((item) => {
      const routeKey = normalizeRoute(item.routeNo);
      const normalized = {
        route: item.routeNo,
        etaMinutes: Number((item.arrivalSec / 60).toFixed(2)),
        etaSeconds: Math.max(1, Math.round(item.arrivalSec)),
      };
      const bucket = routeBuckets.get(routeKey) ?? [];
      const duplicated = bucket.some(
        (candidate) => Math.abs((candidate.etaSeconds ?? 0) - (normalized.etaSeconds ?? 0)) < 10,
      );
      if (!duplicated) {
        bucket.push(normalized);
      }
      routeBuckets.set(routeKey, bucket);
    });

    // 같은 노선은 첫차+다음차(최대 2개)까지 유지한다.
    routeBuckets.forEach((bucket) => {
      bucket.sort((a, b) => (a.etaSeconds ?? 999999) - (b.etaSeconds ?? 999999));
      const deduped: typeof bucket = [];
      for (const item of bucket) {
        const prev = deduped[deduped.length - 1];
        // 동일 차량으로 보이는 중복(30초 이내)은 제거
        if (prev && Math.abs((prev.etaSeconds ?? 0) - (item.etaSeconds ?? 0)) < 30) {
          continue;
        }
        deduped.push(item);
        if (deduped.length >= 2) {
          break;
        }
      }
      candidatePool.push(...deduped);
    });

    // 추천 경로 기반 ETA를 보정치로 유지한다.
    fallbackList.forEach((fallback) => {
      const fallbackKey = normalizeRoute(fallback.route);
      const existingIndex = candidatePool.findIndex(
        (item) => normalizeRoute(item.route) === fallbackKey,
      );
      if (existingIndex >= 0) {
        candidatePool[existingIndex] = fallback;
      } else {
        candidatePool.push(fallback);
      }
    });

    const minKnownSec = Math.min(
      ...candidatePool
        .map((item) => item.etaSeconds ?? Number.POSITIVE_INFINITY),
    );
    const anchorSec =
      typeof fallbackEtaSeconds === 'number' && fallbackEtaSeconds > 0
        ? Math.round(fallbackEtaSeconds)
        : Number.isFinite(minKnownSec)
          ? Math.round(minKnownSec)
          : undefined;
    if (typeof anchorSec !== 'number' || anchorSec <= 0) {
      return candidatePool
        .filter((item) => (item.etaSeconds ?? 0) > 0)
        .sort((a, b) => (a.etaSeconds ?? 999999) - (b.etaSeconds ?? 999999))
        .slice(0, 8);
    }
    // 실시간 API 변동폭이 큰 시간대에는 고정 윈도우가 후보를 과도하게 제거할 수 있다.
    // 도착시간 정합성은 정렬 우선순위로 유지하고, 후보 수집은 넓게 허용한다.
    const lowerBound = Math.max(1, anchorSec - 20 * 60);
    const upperBound = anchorSec + 45 * 60;

    const merged = candidatePool
      .filter((item) => {
        const sec = item.etaSeconds ?? 0;
        return sec > 0 && sec >= lowerBound && sec <= upperBound;
      })
      .sort((a, b) => (a.etaSeconds ?? 999999) - (b.etaSeconds ?? 999999))
      .slice(0, 8);

    if (merged.length > 0) {
      return merged;
    }

    // 윈도우 필터로 전부 탈락하면, 유효 ETA 후보를 그대로 반환해 정보없음 표시를 방지한다.
    const unbounded = candidatePool
      .filter((item) => (item.etaSeconds ?? 0) > 0)
      .sort((a, b) => (a.etaSeconds ?? 999999) - (b.etaSeconds ?? 999999))
      .slice(0, 8);

    return unbounded.length > 0 ? unbounded : fallbackList;
  }

  private async buildPassStops(segment: MobilitySegment): Promise<string[]> {
    const routeId = (segment.busRouteId ?? '').trim();
    if (!routeId) {
      return [];
    }
    const stations = await this.seoulBusClient.getRouteStations(routeId);
    if (stations.length === 0) {
      return [];
    }

    const startStationId = (segment.startStationId ?? '').trim();
    const endStationId = (segment.endStationId ?? '').trim();
    const startArsId = (segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const endArsId = (segment.endArsId ?? '').replace(/[^0-9]/g, '');
    const normalizeName = (value: string) =>
      value
        .replace(/\(.*?\)/g, '')
        .replace(/[\s.\-·,]/g, '')
        .trim();
    const startName = normalizeName(segment.startName ?? '');
    const endName = normalizeName(segment.endName ?? '');

    const findIndex = (fn: (station: (typeof stations)[number]) => boolean) =>
      stations.findIndex((station) => fn(station));

    let startIdx = findIndex((station) => !!startStationId && station.stationId === startStationId);
    if (startIdx < 0) {
      startIdx = findIndex((station) => !!startArsId && (station.arsId ?? '').replace(/[^0-9]/g, '') === startArsId);
    }
    if (startIdx < 0) {
      startIdx = findIndex((station) => !!startName && normalizeName(station.stationName) === startName);
    }
    if (startIdx < 0) {
      startIdx = findIndex((station) => {
        if (!startName) return false;
        const stationNorm = normalizeName(station.stationName);
        return stationNorm.includes(startName) || startName.includes(stationNorm);
      });
    }

    let endIdx = findIndex((station) => !!endStationId && station.stationId === endStationId);
    if (endIdx < 0) {
      endIdx = findIndex((station) => !!endArsId && (station.arsId ?? '').replace(/[^0-9]/g, '') === endArsId);
    }
    if (endIdx < 0) {
      endIdx = findIndex((station) => !!endName && normalizeName(station.stationName) === endName);
    }
    if (endIdx < 0) {
      endIdx = findIndex((station) => {
        if (!endName) return false;
        const stationNorm = normalizeName(station.stationName);
        return stationNorm.includes(endName) || endName.includes(stationNorm);
      });
    }

    if (startIdx < 0 || endIdx < 0) {
      return [];
    }

    const from = Math.min(startIdx, endIdx);
    const to = Math.max(startIdx, endIdx);
    const sliced = stations.slice(from, to + 1).map((station) => station.stationName.trim()).filter(Boolean);
    return Array.from(new Set(sliced));
  }
}
