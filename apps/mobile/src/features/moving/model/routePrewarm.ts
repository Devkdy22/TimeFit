import type { MapCoordinate, MapRouteSegment } from '../../map/types';
import type { MobilityRoutePayload } from '../../../services/api/client';
import { fetchKakaoWalkGeometry } from '../../../services/api/client';
import { getTransitLineStyle } from '../../route-recommend/model/transitLineStyle';
import { sliceSubwayLine } from '../../../data/subwayLineUtils';

type PrewarmedRoute = {
  routeId: string;
  segments: MapRouteSegment[];
  pathPoints: MapCoordinate[];
};

const prewarmCache = new Map<string, PrewarmedRoute>();
const prewarmInFlight = new Map<string, Promise<PrewarmedRoute>>();

function normalizePathPoints(points: Array<{ lat: number; lng: number }>) {
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

function modeToMapMode(mode: 'walk' | 'bus' | 'subway' | 'car'): MapRouteSegment['mode'] | null {
  if (mode === 'walk') return 'WALK';
  if (mode === 'bus') return 'BUS';
  if (mode === 'subway') return 'SUBWAY';
  return null;
}

function pickColor(segment: NonNullable<MobilityRoutePayload['mobilitySegments']>[number], mode: MapRouteSegment['mode']) {
  if (mode === 'WALK') return '#8A8F98';
  if (mode === 'SUBWAY') return '#64748B';
  const style = getTransitLineStyle({
    mode: 'bus',
    lineName: segment.lineLabel,
    routeNo: segment.lineLabel,
  });
  return style.color || '#2D7FF9';
}

function zIndex(mode: MapRouteSegment['mode']) {
  if (mode === 'WALK') return 20;
  if (mode === 'BUS') return 30;
  return 40;
}

function collectPath(segments: MapRouteSegment[]) {
  return normalizePathPoints(segments.flatMap((segment) => segment.polyline));
}

function segmentStartPoint(segment: NonNullable<MobilityRoutePayload['mobilitySegments']>[number]) {
  if (typeof segment.startLat === 'number' && typeof segment.startLng === 'number') {
    return { lat: segment.startLat, lng: segment.startLng };
  }
  const first = segment.pathPoints?.[0];
  if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng)) {
    return { lat: first.lat, lng: first.lng };
  }
  return null;
}

function segmentEndPoint(segment: NonNullable<MobilityRoutePayload['mobilitySegments']>[number]) {
  if (typeof segment.endLat === 'number' && typeof segment.endLng === 'number') {
    return { lat: segment.endLat, lng: segment.endLng };
  }
  const last = segment.pathPoints?.[segment.pathPoints.length - 1];
  if (last && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
    return { lat: last.lat, lng: last.lng };
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('prewarm-timeout')), ms)),
  ]);
}

export function getPrewarmedRoute(routeId?: string | null) {
  if (!routeId) return null;
  return prewarmCache.get(routeId) ?? null;
}

export function prewarmRoute(route: MobilityRoutePayload) {
  const routeId = route.id;
  const cached = prewarmCache.get(routeId);
  if (cached) return Promise.resolve(cached);
  const running = prewarmInFlight.get(routeId);
  if (running) return running;

  const task = (async () => {
    const segmentsRaw = route.mobilitySegments ?? [];
    const built = await Promise.all(
      segmentsRaw.map(async (segment, index): Promise<MapRouteSegment | null> => {
        const mode = modeToMapMode(segment.mode);
        if (!mode) return null;
        const id = `prewarm-${index}-${mode.toLowerCase()}`;

        if (mode === 'SUBWAY') {
          const sliced = sliceSubwayLine(
            segment.lineLabel ?? '',
            segment.startName,
            segment.endName,
            typeof segment.startLat === 'number' && typeof segment.startLng === 'number'
              ? { lat: segment.startLat, lng: segment.startLng }
              : undefined,
            typeof segment.endLat === 'number' && typeof segment.endLng === 'number'
              ? { lat: segment.endLat, lng: segment.endLng }
              : undefined,
          );
          if (sliced.length >= 3) {
            return { id, mode, polyline: sliced, color: pickColor(segment, mode), zIndex: zIndex(mode) };
          }
        }

        if (mode === 'BUS') {
          const busRaw = normalizePathPoints(segment.routeGeometry ?? []);
          if (busRaw.length >= 20) {
            return { id, mode, polyline: busRaw, color: pickColor(segment, mode), zIndex: zIndex(mode) };
          }
          if (
            typeof segment.startLat === 'number' &&
            typeof segment.startLng === 'number' &&
            typeof segment.endLat === 'number' &&
            typeof segment.endLng === 'number'
          ) {
            try {
              const road = await withTimeout(
                fetchKakaoWalkGeometry({
                  origin: { name: segment.startName ?? 'bus-start', lat: segment.startLat, lng: segment.startLng },
                  destination: { name: segment.endName ?? 'bus-end', lat: segment.endLat, lng: segment.endLng },
                }),
                1600,
              );
              const normalized = normalizePathPoints(road);
              if (normalized.length >= 20) {
                return { id, mode, polyline: normalized, color: pickColor(segment, mode), zIndex: zIndex(mode) };
              }
            } catch {}
          }
          return null;
        }

        const prev = index > 0 ? segmentsRaw[index - 1] : undefined;
        const next = index < segmentsRaw.length - 1 ? segmentsRaw[index + 1] : undefined;
        const start =
          segmentStartPoint(segment) ??
          (prev ? segmentEndPoint(prev) : null);
        const end =
          segmentEndPoint(segment) ??
          (next ? segmentStartPoint(next) : null);

        if (start && end) {
          try {
            const walkRoad = await withTimeout(
              fetchKakaoWalkGeometry({
                origin: { name: segment.startName ?? 'walk-start', lat: start.lat, lng: start.lng },
                destination: { name: segment.endName ?? 'walk-end', lat: end.lat, lng: end.lng },
              }),
              1400,
            );
            const normalizedRoad = normalizePathPoints(walkRoad);
            if (normalizedRoad.length >= 2) {
              return { id, mode, polyline: normalizedRoad, color: pickColor(segment, mode), zIndex: zIndex(mode) };
            }
          } catch {}
        }

        const walk = normalizePathPoints([
          ...(segment.pathPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? []),
          ...(start ? [start] : []),
          ...(end ? [end] : []),
        ]);
        if (walk.length >= 2) {
          return { id, mode, polyline: walk, color: pickColor(segment, mode), zIndex: zIndex(mode) };
        }
        return null;
      }),
    );

    const segments = built.filter((segment): segment is MapRouteSegment => segment !== null);
    const pathPoints = collectPath(segments);
    const payload: PrewarmedRoute = { routeId, segments, pathPoints };
    prewarmCache.set(routeId, payload);
    return payload;
  })().finally(() => {
    prewarmInFlight.delete(routeId);
  });

  prewarmInFlight.set(routeId, task);
  return task;
}
