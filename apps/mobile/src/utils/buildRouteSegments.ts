import {
  fetchKakaoWalkGeometry,
  type MobilityRoutePayload,
  type RecommendLocation,
} from '../services/api/client';
import {
  fetchSeoulBusRoutePathGeometry,
  fetchSeoulStationsByRoute,
} from '../services/seoulBusApi';
import type { MapCoordinate } from '../features/map/types';
import {
  buildDirectLineFallback,
  buildImmediateFallbackAll,
  buildPassStopsFallback,
  type ResolvedSegment,
  type RouteSegment,
} from './buildRouteSegmentsFallback';
import { timeoutPromise } from './timeoutPromise';
import { getSubwayLineGeometry, sliceSubwayGeometry } from './subwayLineCache';

export type RawRoute = NonNullable<MobilityRoutePayload>;
export type Coord = MapCoordinate;

function normalizePathPoints(points: Array<{ lat: number; lng: number }>): MapCoordinate[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        Math.abs(point.lat) <= 90 &&
        Math.abs(point.lng) <= 180,
    )
    .filter((point, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];
      return Math.abs(prev.lat - point.lat) > 0.000001 || Math.abs(prev.lng - point.lng) > 0.000001;
    });
}

function toRouteSegments(route: RawRoute): RouteSegment[] {
  return (route.mobilitySegments ?? []).filter((segment) => segment.mode !== 'car');
}

function toRecommendLocation(name: string, coord: MapCoordinate): RecommendLocation {
  return { name, lat: coord.lat, lng: coord.lng };
}

function nearestIndex(points: MapCoordinate[], target: MapCoordinate): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const d = (p.lat - target.lat) * (p.lat - target.lat) + (p.lng - target.lng) * (p.lng - target.lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function resolveEdgeCoord(
  segment: RouteSegment,
  key: 'start' | 'end',
  fallback: MapCoordinate,
): MapCoordinate {
  if (key === 'start' && typeof segment.startLat === 'number' && typeof segment.startLng === 'number') {
    return { lat: segment.startLat, lng: segment.startLng };
  }
  if (key === 'end' && typeof segment.endLat === 'number' && typeof segment.endLng === 'number') {
    return { lat: segment.endLat, lng: segment.endLng };
  }
  return fallback;
}

function geometryFromSegment(segment: RouteSegment): MapCoordinate[] {
  const routeGeometry = normalizePathPoints(
    (segment.routeGeometry ?? []).map((point) => ({ lat: point.lat, lng: point.lng })),
  );
  if (routeGeometry.length >= 2) {
    return routeGeometry;
  }
  const pathPoints = normalizePathPoints(
    (segment.pathPoints ?? []).map((point) => ({ lat: point.lat, lng: point.lng })),
  );
  return pathPoints;
}

function minPointsForMode(mode: RouteSegment['mode']): number {
  if (mode === 'subway') return 12;
  if (mode === 'bus') return 10;
  return 2;
}

function isSufficientSegmentGeometry(segment: RouteSegment, points: MapCoordinate[]): boolean {
  // BUS/SUBWAY는 ODsay geometry가 희소(5~14pt)해서 지그재그/직선화가 잦다.
  // 품질 안정화를 위해 WALK만 segment geometry를 직접 사용한다.
  if (segment.mode === 'bus' || segment.mode === 'subway') {
    return false;
  }
  return points.length >= minPointsForMode(segment.mode);
}

async function resolveWalkSegment(segment: RouteSegment, fallback: ResolvedSegment): Promise<ResolvedSegment> {
  const prebuilt = geometryFromSegment(segment);
  if (isSufficientSegmentGeometry(segment, prebuilt)) {
    return {
      ...fallback,
      polyline: prebuilt,
    };
  }

  const start = resolveEdgeCoord(segment, 'start', fallback.polyline[0]);
  const end = resolveEdgeCoord(segment, 'end', fallback.polyline[fallback.polyline.length - 1]);
  try {
    const points = await Promise.race([
      fetchKakaoWalkGeometry({
        origin: toRecommendLocation(segment.startName ?? 'walk-start', start),
        destination: toRecommendLocation(segment.endName ?? 'walk-end', end),
      }),
      timeoutPromise(2000),
    ]);
    const normalized = normalizePathPoints(points);
    if (normalized.length >= 2) {
      return {
        ...fallback,
        polyline: normalized,
      };
    }
    return buildPassStopsFallback(segment);
  } catch {
    return buildPassStopsFallback(segment);
  }
}

async function resolveBusSegment(segment: RouteSegment, fallback: ResolvedSegment): Promise<ResolvedSegment> {
  const prebuilt = geometryFromSegment(segment);
  if (isSufficientSegmentGeometry(segment, prebuilt)) {
    return {
      ...fallback,
      polyline: prebuilt,
    };
  }

  if (!segment.busRouteId) {
    return buildPassStopsFallback(segment);
  }
  try {
    const [path, stations] = await Promise.race([
      Promise.all([fetchSeoulBusRoutePathGeometry(segment.busRouteId), fetchSeoulStationsByRoute(segment.busRouteId)]),
      timeoutPromise(2500),
    ]);

    const polyline = normalizePathPoints(path.map((p) => ({ lat: p.latitude, lng: p.longitude })));
    if (polyline.length < 2) {
      return buildPassStopsFallback(segment);
    }

    const startStation =
      stations.find((s) => s.id === segment.startStationId) ??
      stations.find((s) => (s.name ?? '').trim() === (segment.startName ?? '').trim());
    const endStation =
      stations.find((s) => s.id === segment.endStationId) ??
      stations.find((s) => (s.name ?? '').trim() === (segment.endName ?? '').trim());

    if (!startStation || !endStation) {
      return { ...fallback, polyline };
    }

    const startIdx = nearestIndex(polyline, { lat: startStation.lat, lng: startStation.lng });
    const endIdx = nearestIndex(polyline, { lat: endStation.lat, lng: endStation.lng });
    const sliced =
      startIdx <= endIdx ? polyline.slice(startIdx, endIdx + 1) : polyline.slice(endIdx, startIdx + 1).reverse();

    return {
      ...fallback,
      polyline: sliced.length >= 2 ? sliced : polyline,
    };
  } catch {
    return buildPassStopsFallback(segment);
  }
}

async function resolveSubwaySegment(segment: RouteSegment, fallback: ResolvedSegment): Promise<ResolvedSegment> {
  const prebuilt = geometryFromSegment(segment);
  if (isSufficientSegmentGeometry(segment, prebuilt)) {
    return {
      ...fallback,
      polyline: prebuilt,
    };
  }

  const lineId = (segment.lineLabel ?? segment.lineId ?? '').trim();
  const startStationById = segment.startStationId ?? '';
  const endStationById = segment.endStationId ?? '';
  const startStationByName = segment.startName ?? '';
  const endStationByName = segment.endName ?? '';

  const cachedSliceById =
    lineId && startStationById && endStationById
      ? sliceSubwayGeometry(lineId, startStationById, endStationById, true)
      : null;
  const cachedSliceByName =
    lineId && startStationByName && endStationByName
      ? sliceSubwayGeometry(lineId, startStationByName, endStationByName, true)
      : null;
  const cachedSlice = cachedSliceById ?? cachedSliceByName;
  if (cachedSlice && cachedSlice.length >= 2) {
    console.log('[RouteGeometry][SUBWAY_CACHE_HIT]', {
      lineId,
      startStation: startStationById || startStationByName,
      endStation: endStationById || endStationByName,
      pointCount: cachedSlice.length,
    });
    return {
      ...fallback,
      polyline: cachedSlice.map(([lat, lng]) => ({ lat, lng })),
    };
  }
  console.log('[RouteGeometry][SUBWAY_CACHE_MISS]', {
    lineId,
    startStation: startStationById || startStationByName,
    endStation: endStationById || endStationByName,
  });

  const hasCacheLine = lineId ? getSubwayLineGeometry(lineId) !== null : false;
  if (hasCacheLine) {
    console.log('[RouteGeometry][SUBWAY_CACHE_LINE_FOUND_BUT_SLICE_FAIL]', { lineId });
    return buildPassStopsFallback(segment);
  }

  try {
    const start = fallback.polyline[0];
    const end = fallback.polyline[fallback.polyline.length - 1];
    const points = await Promise.race([
      fetchKakaoWalkGeometry({
        origin: toRecommendLocation(segment.startName ?? 'subway-start', start),
        destination: toRecommendLocation(segment.endName ?? 'subway-end', end),
      }),
      timeoutPromise(2000),
    ]);
    const normalized = normalizePathPoints(points);
    if (normalized.length >= 2) {
      return {
        ...fallback,
        polyline: normalized,
      };
    }
    return buildPassStopsFallback(segment);
  } catch {
    return buildPassStopsFallback(segment);
  }
}

export async function buildRouteSegments(
  route: RawRoute,
  options: { origin: Coord; destination: Coord },
  onProgressUpdate?: (segments: ResolvedSegment[]) => void,
): Promise<ResolvedSegment[]> {
  const pipelineStartAt = Date.now();
  const segments = toRouteSegments(route);
  const fallbackAll = buildImmediateFallbackAll(segments, options.origin, options.destination);
  const partial = [...fallbackAll];
  const upgradedFlags = new Array<boolean>(fallbackAll.length).fill(false);
  console.log('[RouteGeometry][PIPELINE_START]', {
    routeId: route.id ?? null,
    segmentCount: segments.length,
    at: pipelineStartAt,
  });
  console.log('[RouteGeometry][FALLBACK_T0]', {
    routeId: route.id ?? null,
    segmentCount: fallbackAll.length,
    elapsedMs: Date.now() - pipelineStartAt,
  });

  const segmentStartTimes: number[] = [];
  const segmentDurations: number[] = [];

  const tasks = segments.map((segment, index) => {
    const fallback = fallbackAll[index] ?? buildDirectLineFallback(segment);

    const run = async (): Promise<ResolvedSegment> => {
      const startTs = Date.now();
      segmentStartTimes[index] = startTs;
      console.log('[RouteGeometry][SEGMENT_FETCH_START]', {
        routeId: route.id ?? null,
        segmentId: fallback.id,
        mode: segment.mode,
        startedAt: startTs,
      });
      try {
        let resolved = fallback;
        if (segment.mode === 'walk') {
          resolved = await resolveWalkSegment(segment, fallback);
          const prebuiltLen = geometryFromSegment(segment).length;
          console.log('[RouteGeometry][WALK]', {
            segmentId: fallback.id,
            source: isSufficientSegmentGeometry(segment, geometryFromSegment(segment))
              ? 'segment-geometry'
              : resolved.polyline.length >= 2
                ? 'kakao-directions'
                : 'fallback',
            pointCount: resolved.polyline.length,
            startedAt: startTs,
            elapsedMs: Date.now() - startTs,
            prebuiltLen,
          });
          return resolved;
        }
        if (segment.mode === 'bus') {
          resolved = await resolveBusSegment(segment, fallback);
          const prebuiltLen = geometryFromSegment(segment).length;
          console.log('[RouteGeometry][BUS]', {
            segmentId: fallback.id,
            source: isSufficientSegmentGeometry(segment, geometryFromSegment(segment))
              ? 'segment-geometry'
              : resolved.polyline.length >= 2
                ? 'seoul-bus-routepath'
                : 'fallback',
            pointCount: resolved.polyline.length,
            startedAt: startTs,
            elapsedMs: Date.now() - startTs,
            prebuiltLen,
          });
          return resolved;
        }

        resolved = await resolveSubwaySegment(segment, fallback);
        const prebuiltLen = geometryFromSegment(segment).length;
        console.log('[RouteGeometry][SUBWAY_SOURCE]', {
          segmentId: fallback.id,
          source: isSufficientSegmentGeometry(segment, geometryFromSegment(segment))
            ? 'segment-geometry'
            : resolved.polyline.length >= 2
              ? 'subway-cache-or-inferred'
              : 'fallback',
          lineName: segment.lineLabel ?? segment.lineId ?? null,
          pointCount: resolved.polyline.length,
          startedAt: startTs,
          elapsedMs: Date.now() - startTs,
          prebuiltLen,
        });
        return resolved;
      } catch {
        return fallback;
      } finally {
        segmentDurations[index] = Date.now() - startTs;
      }
    };

    return run()
      .then((resolved) => {
        partial[index] = resolved;
        upgradedFlags[index] = resolved.polyline.length >= 2 && resolved.polyline !== fallback.polyline;
        const resolvedCount = upgradedFlags.filter(Boolean).length;
        console.log('[RouteGeometry][PROGRESS_UPDATE]', {
          routeId: route.id ?? null,
          resolvedCount,
          total: partial.length,
          elapsedMs: Date.now() - pipelineStartAt,
        });
        onProgressUpdate?.([...partial]);
        return resolved;
      })
      .catch(() => {
        partial[index] = fallback;
        console.log('[RouteGeometry][PROGRESS_UPDATE]', {
          routeId: route.id ?? null,
          resolvedCount: 0,
          total: partial.length,
          elapsedMs: Date.now() - pipelineStartAt,
          fallbackOnly: true,
        });
        onProgressUpdate?.([...partial]);
        return fallback;
      });
  });

  const settled = await Promise.allSettled(tasks);
  const resolved = settled.map((item, index) => (item.status === 'fulfilled' ? item.value : partial[index]));
  const completed = resolved.map((segment, index) => segment ?? partial[index] ?? fallbackAll[index]).filter(Boolean);
  const startSpreadMs =
    segmentStartTimes.length > 1 ? Math.max(...segmentStartTimes) - Math.min(...segmentStartTimes) : 0;
  const slowestMs = segmentDurations.length > 0 ? Math.max(...segmentDurations) : 0;
  console.log('[RouteGeometry][PIPELINE_DONE]', {
    routeId: route.id ?? null,
    totalElapsedMs: Date.now() - pipelineStartAt,
    slowestSegmentMs: slowestMs,
    segmentStartSpreadMs: startSpreadMs,
    nonNullCount: completed.length,
  });
  return completed;
}
