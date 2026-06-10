import { getTransitLineStyle } from '../features/route-recommend/model/transitLineStyle';
import type { MapCoordinate, MapRouteSegment } from '../features/map/types';
import { subwayColors } from '../data/subwayLineGeometry';
import type { MobilityRoutePayload } from '../services/api/client';

export type TransitMode = MapRouteSegment['mode'];
export type ResolvedSegment = MapRouteSegment;
export type RouteSegment = NonNullable<MobilityRoutePayload['mobilitySegments']>[number];

const WALK_COLOR = '#8A8F98';

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

function modeToMapMode(mode: RouteSegment['mode']): TransitMode | null {
  if (mode === 'walk') return 'WALK';
  if (mode === 'bus') return 'BUS';
  if (mode === 'subway') return 'SUBWAY';
  return null;
}

function segmentZIndex(mode: TransitMode): number {
  if (mode === 'WALK') return 20;
  if (mode === 'BUS') return 30;
  return 40;
}

function pickSegmentColor(segment: RouteSegment, mode: TransitMode): string {
  if (mode === 'WALK') {
    return WALK_COLOR;
  }

  if (mode === 'BUS') {
    const style = getTransitLineStyle({
      mode: 'bus',
      lineName: segment.lineLabel,
      routeNo: segment.lineLabel,
    });
    return style.color;
  }

  const label = (segment.lineLabel ?? '').replace(/\s+/g, '');
  for (const [lineName, color] of Object.entries(subwayColors)) {
    if (label === lineName || label.includes(lineName)) {
      return color;
    }
  }
  return '#64748B';
}

function resolveEdgePoint(point: { lat?: number; lng?: number } | undefined): MapCoordinate | null {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return null;
  }
  return { lat: point.lat, lng: point.lng };
}

function buildSegmentId(segment: RouteSegment, index = 0): string {
  const mode = modeToMapMode(segment.mode) ?? 'WALK';
  return `segment-${index}-${mode.toLowerCase()}`;
}

function normalizePolyline(points: MapCoordinate[]): MapCoordinate[] {
  const normalized = normalizePathPoints(points);
  if (normalized.length >= 2) {
    return normalized;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last) {
    return [first, last];
  }
  if (first) {
    return [first, first];
  }
  return [
    { lat: 37.5665, lng: 126.978 },
    { lat: 37.5666, lng: 126.9781 },
  ];
}

export function buildDirectLineFallback(segment: RouteSegment): ResolvedSegment {
  const mode = modeToMapMode(segment.mode) ?? 'WALK';
  const start = resolveEdgePoint({ lat: segment.startLat, lng: segment.startLng });
  const end = resolveEdgePoint({ lat: segment.endLat, lng: segment.endLng });

  const fallbackPoints = normalizePathPoints(
    [start, end].filter((point): point is MapCoordinate => point !== null),
  );
  const polyline =
    fallbackPoints.length >= 2
      ? fallbackPoints
      : normalizePolyline(
          (segment.pathPoints ?? []).map((point) => ({ lat: point.lat, lng: point.lng })),
        );

  return {
    id: buildSegmentId(segment),
    mode,
    polyline,
    color: pickSegmentColor(segment, mode),
    zIndex: segmentZIndex(mode),
  };
}

export function buildPassStopsFallback(segment: RouteSegment): ResolvedSegment {
  const path = normalizePathPoints((segment.pathPoints ?? []).map((point) => ({ lat: point.lat, lng: point.lng })));
  if (path.length < 2) {
    return buildDirectLineFallback(segment);
  }
  const base = buildDirectLineFallback(segment);
  return {
    ...base,
    polyline: path,
  };
}

export function buildImmediateFallbackAll(
  segments: RouteSegment[],
  origin: MapCoordinate,
  destination: MapCoordinate,
): ResolvedSegment[] {
  if (segments.length === 0) {
    return [
      {
        id: 'segment-0-walk',
        mode: 'WALK',
        polyline: [origin, destination],
        color: WALK_COLOR,
        zIndex: 20,
      },
    ];
  }

  return segments.map((segment, index) => {
    const patched: RouteSegment = {
      ...segment,
      startLat: typeof segment.startLat === 'number' ? segment.startLat : index === 0 ? origin.lat : segment.startLat,
      startLng: typeof segment.startLng === 'number' ? segment.startLng : index === 0 ? origin.lng : segment.startLng,
      endLat:
        typeof segment.endLat === 'number'
          ? segment.endLat
          : index === segments.length - 1
            ? destination.lat
            : segment.endLat,
      endLng:
        typeof segment.endLng === 'number'
          ? segment.endLng
          : index === segments.length - 1
            ? destination.lng
            : segment.endLng,
    };

    let resolved: ResolvedSegment;
    if (patched.mode === 'subway' || patched.mode === 'bus') {
      resolved = buildPassStopsFallback(patched);
    } else {
      resolved = buildDirectLineFallback(patched);
    }
    return {
      ...resolved,
      id: `segment-${index}-${resolved.mode.toLowerCase()}`,
    };
  });
}
