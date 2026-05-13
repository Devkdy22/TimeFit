import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useCommutePlan } from '../../commute-state/context';
import { useTripTracking } from '../../../hooks/useTripTracking';
import { movingMapMockData } from '../../../mocks/map';
import type { MapCoordinate, MapRouteSegment, MovingMapData } from '../../map/types';
import type { UiStatus } from '../../../theme/status-config';
import {
  fetchKakaoWalkGeometry,
  type MobilityRoutePayload,
  type RecommendLocation,
} from '../../../services/api/client';
import {
  fetchSeoulBusRoutePathGeometry,
  fetchSeoulStationsByRoute,
  type SeoulBusStation,
} from '../../../services/seoulBusApi';
import { getTransitLineStyle } from '../../route-recommend/model/transitLineStyle';
import { subwayColors, subwayLineGeometry } from '../../../data/subwayLineGeometry';

interface TransitLineItem {
  id: string;
  mode: 'walk' | 'bus' | 'subway';
  lineLabel: string;
  etaText: string;
  stopName: string;
  boardingStopName?: string;
  fastExitHint?: string;
  isCurrent: boolean;
}

interface UpcomingAction {
  title: string;
  subtitle: string;
  timeText: string;
}

function minuteTextFromEta(etaText: string | undefined, fallbackMinutes: number) {
  if (!etaText) {
    return `${fallbackMinutes}분`;
  }
  const parsed = Number.parseInt(etaText.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(parsed)) {
    return `${fallbackMinutes}분`;
  }
  return `${parsed}분`;
}

function normalizeLineLabel(lineLabel: string | undefined) {
  if (!lineLabel) {
    return '버스';
  }
  return lineLabel.replace(/\s+/g, ' ').trim();
}

function extractFastExitHint(input?: string) {
  if (!input) {
    return null;
  }
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  const gateMatch = text.match(/(\d+\s*-\s*\d+)\s*번?/);
  if (gateMatch?.[1]) {
    return `${gateMatch[1].replace(/\s*/g, '')}번`;
  }
  const coachMatch = text.match(/(\d+)\s*(?:번째)?\s*칸/);
  if (coachMatch?.[1]) {
    return `${coachMatch[1]}번째 칸`;
  }
  if (text.includes('앞칸')) {
    return '앞칸';
  }
  if (text.includes('뒷칸')) {
    return '뒷칸';
  }
  return null;
}

function mapApiStatusToUiStatus(status: '여유' | '주의' | '긴급' | null): UiStatus {
  if (status === '주의') {
    return 'warning';
  }
  if (status === '긴급') {
    return 'urgent';
  }
  return 'relaxed';
}

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
      if (index === 0) {
        return true;
      }
      const prev = arr[index - 1];
      return Math.abs(prev.lat - point.lat) > 0.000001 || Math.abs(prev.lng - point.lng) > 0.000001;
    });
}

type TrackingSegment = NonNullable<MobilityRoutePayload['mobilitySegments']>[number];

const WALK_COLOR = '#8A8F98';
const SUBWAY_LINE_COLORS = subwayColors;
interface BusRouteGeometryPayload {
  polyline: MapCoordinate[];
  stations: SeoulBusStation[];
}

const routeCache = new Map<string, BusRouteGeometryPayload>();
const routeInFlight = new Map<string, Promise<BusRouteGeometryPayload | null>>();

function modeToMapMode(mode: TrackingSegment['mode']): MapRouteSegment['mode'] | null {
  if (mode === 'walk') return 'WALK';
  if (mode === 'bus') return 'BUS';
  if (mode === 'subway') return 'SUBWAY';
  return null;
}

function pickSegmentColor(segment: TrackingSegment, mode: MapRouteSegment['mode']) {
  if (mode === 'WALK') {
    return WALK_COLOR;
  }

  if (mode === 'BUS') {
    const style = getTransitLineStyle({
      mode: 'bus',
      lineName: segment.lineLabel,
      routeNo: segment.lineLabel,
    });
    if (style.color === '#E34D4D') return '#E34D4D';
    if (style.color === '#8CD654') return '#8CD654';
    if (style.color === '#2FA84F') return '#2FA84F';
    return '#2D7FF9';
  }

  const label = (segment.lineLabel ?? '').replace(/\s+/g, '');
  for (const [lineName, color] of Object.entries(SUBWAY_LINE_COLORS)) {
    if (label === lineName || label.includes(lineName)) {
      return color;
    }
  }
  return '#64748B';
}

function segmentZIndex(mode: MapRouteSegment['mode']) {
  if (mode === 'WALK') return 20;
  if (mode === 'BUS') return 30;
  return 40;
}

function buildFallbackFromSegmentPoints(segment: TrackingSegment): MapCoordinate[] {
  return normalizePathPoints([
    ...(segment.pathPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? []),
    ...(typeof segment.startLat === 'number' && typeof segment.startLng === 'number'
      ? [{ lat: segment.startLat, lng: segment.startLng }]
      : []),
    ...(typeof segment.endLat === 'number' && typeof segment.endLng === 'number'
      ? [{ lat: segment.endLat, lng: segment.endLng }]
      : []),
  ]);
}

function toMeters(a: MapCoordinate, b: MapCoordinate) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function findClosestIndex(polyline: MapCoordinate[], target: MapCoordinate) {
  let minDist = Number.POSITIVE_INFINITY;
  let index = 0;

  for (let i = 0; i < polyline.length; i += 1) {
    const p = polyline[i];
    const d = (p.lat - target.lat) * (p.lat - target.lat) + (p.lng - target.lng) * (p.lng - target.lng);
    if (d < minDist) {
      minDist = d;
      index = i;
    }
  }

  return index;
}

async function resolveWalkGeometry(segment: TrackingSegment) {
  if (
    typeof segment.startLat !== 'number' ||
    typeof segment.startLng !== 'number' ||
    typeof segment.endLat !== 'number' ||
    typeof segment.endLng !== 'number'
  ) {
    return {
      source: 'fallback',
      points: buildFallbackFromSegmentPoints(segment),
    } as const;
  }

  try {
    const points = await fetchKakaoWalkGeometry({
      origin: {
        name: segment.startName ?? segment.lineLabel ?? 'walk-start',
        lat: segment.startLat,
        lng: segment.startLng,
      } as RecommendLocation,
      destination: {
        name: segment.endName ?? segment.lineLabel ?? 'walk-end',
        lat: segment.endLat,
        lng: segment.endLng,
      } as RecommendLocation,
    });
    return {
      source: 'kakao-directions',
      points: normalizePathPoints(points),
    } as const;
  } catch (error) {
    console.warn('[RouteGeometry][WALK] geometry fetch failed', { error });
    return {
      source: 'fallback',
      points: buildFallbackFromSegmentPoints(segment),
    } as const;
  }
}

async function fetchBusRouteGeometry(busRouteId: string): Promise<BusRouteGeometryPayload | null> {
  const cached = routeCache.get(busRouteId);
  if (cached) {
    return cached;
  }

  const existing = routeInFlight.get(busRouteId);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
      const [pathGeometry, stations] = await Promise.all([
        fetchSeoulBusRoutePathGeometry(busRouteId),
        fetchSeoulStationsByRoute(busRouteId),
      ]);

      const polyline = normalizePathPoints(
        pathGeometry.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        })),
      );
      if (polyline.length < 10) {
        return null;
      }

      const payload = {
        polyline,
        stations,
      } satisfies BusRouteGeometryPayload;

      routeCache.set(busRouteId, payload);
      return payload;
    } catch (error) {
      console.warn('[RouteGeometry][BUS] Seoul API failed', { busRouteId, error });
      return null;
    }
  })().finally(() => {
    routeInFlight.delete(busRouteId);
  });

  routeInFlight.set(busRouteId, task);
  return task;
}

function segmentStartPoint(segment?: TrackingSegment) {
  if (!segment) {
    return null;
  }
  if (typeof segment.startLat === 'number' && typeof segment.startLng === 'number') {
    return { lat: segment.startLat, lng: segment.startLng };
  }
  const first = segment.pathPoints?.[0];
  if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng)) {
    return { lat: first.lat, lng: first.lng };
  }
  return null;
}

function segmentEndPoint(segment?: TrackingSegment) {
  if (!segment) {
    return null;
  }
  if (typeof segment.endLat === 'number' && typeof segment.endLng === 'number') {
    return { lat: segment.endLat, lng: segment.endLng };
  }
  const last = segment.pathPoints?.[segment.pathPoints.length - 1];
  if (last && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
    return { lat: last.lat, lng: last.lng };
  }
  return null;
}

function resolveSegmentEdgePoints(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  const start =
    segmentStartPoint(segment) ??
    segmentEndPoint(previousSegment) ??
    undefined;
  const end =
    segmentEndPoint(segment) ??
    segmentStartPoint(nextSegment) ??
    undefined;
  return {
    start,
    end,
  };
}

function buildSegmentFallbackPolyline(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  const { start, end } = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  if (start && end && toMeters(start, end) > 3) {
    return normalizePathPoints([start, end]);
  }
  return buildFallbackFromSegmentPoints(segment);
}

function normalizeStationToken(value?: string) {
  if (!value) return '';
  return value.replace(/\s+/g, '').replace(/역$/, '').trim();
}

function findStationCoordinate(
  stations: SeoulBusStation[],
  stationId?: string,
  stationName?: string,
): MapCoordinate | undefined {
  const normalizedId = normalizeStationToken(stationId);
  const normalizedName = normalizeStationToken(stationName);
  const byId = normalizedId
    ? stations.find((station) => normalizeStationToken(station.id) === normalizedId)
    : undefined;
  if (byId) {
    return { lat: byId.lat, lng: byId.lng };
  }
  const byName = normalizedName
    ? stations.find((station) => normalizeStationToken(station.name) === normalizedName)
    : undefined;
  if (byName) {
    return { lat: byName.lat, lng: byName.lng };
  }
  return undefined;
}

function resolveSubwayLineName(raw?: string) {
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/\s+/g, '');
  if (subwayLineGeometry[normalized]) {
    return normalized;
  }
  const exact = Object.keys(subwayLineGeometry).find((lineName) => normalized === lineName.replace(/\s+/g, ''));
  if (exact) {
    return exact;
  }
  const partial = Object.keys(subwayLineGeometry).find(
    (lineName) => normalized.includes(lineName.replace(/\s+/g, '')) || lineName.replace(/\s+/g, '').includes(normalized),
  );
  return partial ?? null;
}

async function resolveBusGeometry(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  if ((segment.routeGeometry?.length ?? 0) >= 2) {
    return {
      source: 'route-geometry',
      points: normalizePathPoints(segment.routeGeometry ?? []),
    } as const;
  }

  const segmentId = `${segment.mode}-${segment.lineId ?? segment.busRouteId ?? 'unknown'}-${segment.startName ?? 'start'}-${segment.endName ?? 'end'}`;
  if (!segment.busRouteId) {
    console.warn('[RouteGeometry][BUS][FALLBACK_PASS_STOPS]', {
      segmentId,
      busRouteId: null,
    });
    return {
      source: 'passStops-fallback',
      points: buildSegmentFallbackPolyline(segment, previousSegment, nextSegment),
    } as const;
  }

  const payload = await fetchBusRouteGeometry(segment.busRouteId);
  if (!payload || payload.polyline.length < 10) {
    console.warn('[RouteGeometry][BUS][FALLBACK_PASS_STOPS]', {
      segmentId,
      busRouteId: segment.busRouteId,
    });
    return {
      source: 'passStops-fallback',
      points: buildSegmentFallbackPolyline(segment, previousSegment, nextSegment),
    } as const;
  }

  const fallbackEdge = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  const startStop =
    findStationCoordinate(payload.stations, segment.startStationId, segment.startName) ?? fallbackEdge.start;
  const endStop =
    findStationCoordinate(payload.stations, segment.endStationId, segment.endName) ?? fallbackEdge.end;
  const polyline = payload.polyline;
  let sliced = polyline;
  if (startStop && endStop) {
    const startIdx = findClosestIndex(polyline, startStop);
    const endIdx = findClosestIndex(polyline, endStop);
    if (startIdx < endIdx) {
      sliced = polyline.slice(startIdx, endIdx + 1);
    } else {
      sliced = polyline.slice(endIdx, startIdx + 1).reverse();
    }
  }

  console.log('[RouteGeometry][BUS]', {
    segmentId,
    busRouteId: segment.busRouteId,
    source: 'routePathList',
    totalPoints: polyline.length,
    slicedPoints: sliced.length,
  });

  if (sliced.length < 10) {
    console.warn('[RouteGeometry][BUS][FALLBACK_PASS_STOPS]', {
      segmentId,
      busRouteId: segment.busRouteId,
    });
    return {
      source: 'passStops-fallback',
      points: buildSegmentFallbackPolyline(segment, previousSegment, nextSegment),
    } as const;
  }

  return {
    source: 'seoul-bus-routepath',
    points: sliced,
  } as const;
}

function resolveSubwayGeometry(
  segment: TrackingSegment,
) {
  const lineName = resolveSubwayLineName(segment.lineLabel);
  if (!lineName) {
    console.warn('[RouteGeometry][SUBWAY][NO_LINE_DATA]', segment.lineLabel ?? null);
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      source: 'fallback',
      lineName: segment.lineLabel ?? '지하철',
      points: [] as MapCoordinate[],
    } as const;
  }

  const stations = subwayLineGeometry[lineName] ?? [];
  if (stations.length === 0) {
    console.warn('[RouteGeometry][SUBWAY][NO_LINE_DATA]', lineName);
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      source: 'fallback',
      lineName,
      points: [] as MapCoordinate[],
    } as const;
  }

  const startName = normalizeStationToken(segment.startName);
  const endName = normalizeStationToken(segment.endName);
  const startIndex = stations.findIndex((station) => normalizeStationToken(station.name) === startName);
  const endIndex = stations.findIndex((station) => normalizeStationToken(station.name) === endName);

  if (startIndex === -1 || endIndex === -1) {
    console.warn('[RouteGeometry][SUBWAY][STATION_NOT_FOUND]', {
      lineName,
      start: segment.startName,
      end: segment.endName,
    });
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return {
      source: 'fallback',
      lineName,
      points: [] as MapCoordinate[],
    } as const;
  }

  const slicedStations =
    startIndex < endIndex
      ? stations.slice(startIndex, endIndex + 1)
      : stations.slice(endIndex, startIndex + 1).reverse();

  const polyline = slicedStations.map((station) => ({
    lat: station.lat,
    lng: station.lng,
  }));

  console.log('[RouteGeometry][SUBWAY]', {
    lineName,
    start: segment.startName,
    end: segment.endName,
    pointCount: polyline.length,
  });

  return {
    source: 'subway-line-geometry',
    lineName,
    points: polyline,
  } as const;
}

async function buildRouteSegments(route: NonNullable<ReturnType<typeof useTripTracking>['route']>) {
  const segments = (route.mobilitySegments ?? []).filter((segment) => segment.mode !== 'car');
  const resolved: MapRouteSegment[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const previousSegment = index > 0 ? segments[index - 1] : undefined;
    const nextSegment = index < segments.length - 1 ? segments[index + 1] : undefined;
    const mode = modeToMapMode(segment.mode);
    if (!mode) {
      continue;
    }
    const segmentId = `segment-${index}-${mode.toLowerCase()}`;

    if (mode === 'WALK') {
      const result = await resolveWalkGeometry(segment);
      const ensuredPoints =
        result.points.length >= 2
          ? result.points
          : buildSegmentFallbackPolyline(segment, previousSegment, nextSegment);
      console.log('[RouteGeometry][WALK]', {
        segmentId,
        source: result.source === 'fallback' ? 'kakao-directions-fallback' : result.source,
        pointCount: ensuredPoints.length,
      });
      if (ensuredPoints.length < 2) continue;
      resolved.push({
        id: segmentId,
        mode,
        polyline: ensuredPoints,
        color: pickSegmentColor(segment, mode),
        zIndex: segmentZIndex(mode),
      });
      continue;
    }

    if (mode === 'BUS') {
      const result = await resolveBusGeometry(segment, previousSegment, nextSegment);
      const ensuredPoints =
        result.points.length >= 2
          ? result.points
          : buildSegmentFallbackPolyline(segment, previousSegment, nextSegment);
      console.log('[RouteGeometry][BUS]', {
        segmentId,
        source: result.source,
        pointCount: ensuredPoints.length,
      });
      if (ensuredPoints.length < 2) continue;
      resolved.push({
        id: segmentId,
        mode,
        polyline: ensuredPoints,
        color: pickSegmentColor(segment, mode),
        zIndex: segmentZIndex(mode),
      });
      continue;
    }

    const result = resolveSubwayGeometry(segment);
    const ensuredPoints = result.points;
    console.log('[RouteGeometry][SUBWAY]', {
      segmentId,
      source: result.source,
      lineName: result.lineName,
      pointCount: ensuredPoints.length,
    });
    if (ensuredPoints.length < 3) continue;
    resolved.push({
      id: segmentId,
      mode,
      polyline: ensuredPoints,
      color: pickSegmentColor(segment, mode),
      zIndex: segmentZIndex(mode),
    });
  }

  return resolved;
}

function toPathFromRouteSegments(segmentPolylines: MapRouteSegment[]) {
  const rawPoints = segmentPolylines.flatMap((segment) => segment.polyline);

  const geometry = normalizePathPoints(rawPoints);
  if (geometry.length < 2) {
    return movingMapMockData.routePath.points;
  }
  return geometry;
}

export function useMovingState() {
  const { origin, destination, arrivalAt, selectedRoute } = useCommutePlan();
  const autoStartAttemptedKeyRef = useRef<string | null>(null);
  const locationPermissionRef = useRef<boolean | null>(null);
  const [resolvedRouteSegments, setResolvedRouteSegments] = useState<MapRouteSegment[]>([]);

  const getCurrentPosition = useCallback(async () => {
    if (locationPermissionRef.current === null) {
      const permission = await Location.requestForegroundPermissionsAsync();
      locationPermissionRef.current = permission.granted;
    }

    if (!locationPermissionRef.current) {
      return null;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    return {
      lat: current.coords.latitude,
      lng: current.coords.longitude,
      accuracy: current.coords.accuracy ?? undefined,
      speed: current.coords.speed ?? undefined,
      heading: current.coords.heading ?? undefined,
    };
  }, []);

  const trackingInput = useMemo(
    () => ({
      origin: origin
        ? { name: origin.name, lat: origin.latitude, lng: origin.longitude }
        : undefined,
      destination: destination
        ? { name: destination.name, lat: destination.latitude, lng: destination.longitude }
        : undefined,
      targetArrivalTime: arrivalAt
        ? `${new Date().toISOString().slice(0, 10)}T${arrivalAt}:00.000Z`
        : undefined,
      preferredRouteId: selectedRoute?.id,
      getCurrentPosition,
    }),
    [arrivalAt, destination, getCurrentPosition, origin, selectedRoute?.id],
  );

  const tracking = useTripTracking(trackingInput);
  const trackingKey = useMemo(() => {
    if (!origin || !destination || !arrivalAt) {
      return null;
    }
    const round = (value: number) => value.toFixed(5);
    const preferred = selectedRoute?.id ?? 'default';
    return `${round(origin.latitude)},${round(origin.longitude)}->${round(destination.latitude)},${round(destination.longitude)}@${arrivalAt}#${preferred}`;
  }, [arrivalAt, destination, origin, selectedRoute?.id]);

  useEffect(() => {
    if (!trackingKey) {
      autoStartAttemptedKeyRef.current = null;
      return;
    }

    if (tracking.isRunning) {
      return;
    }

    if (autoStartAttemptedKeyRef.current === trackingKey) {
      return;
    }

    autoStartAttemptedKeyRef.current = trackingKey;
    void tracking.start();
  }, [tracking.isRunning, tracking.start, trackingKey]);

  useEffect(() => {
    const route = tracking.route;
    if (!route) {
      setResolvedRouteSegments([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const nextSegments = await buildRouteSegments(route);
      if (!cancelled) {
        setResolvedRouteSegments(nextSegments);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tracking.route?.id, tracking.route]);

  const status = mapApiStatusToUiStatus(tracking.status);
  const progress = Math.max(0, Math.min(1, tracking.movement?.progress ?? 0));
  const progressPercent = Math.round(progress * 100);
  const remainingDistanceMeters = Math.max(0, Math.round(tracking.movement?.distanceFromRouteMeters ?? 0));
  const remainingTimeMinutes = Math.max(1, Math.round((1 - progress) * ((tracking.route?.estimatedTravelMinutes ?? 45))));

  const mapData: MovingMapData = useMemo(() => {
    const fallback = movingMapMockData;
    const routeSegments = resolvedRouteSegments;
    const routePathPoints =
      routeSegments.length > 0 ? toPathFromRouteSegments(routeSegments) : fallback.routePath.points;
    const currentPointIndex = Math.min(
      Math.max(0, Math.floor(progress * (routePathPoints.length - 1))),
      Math.max(0, routePathPoints.length - 1),
    );
    const currentPoint = routePathPoints[currentPointIndex] ?? fallback.currentLocation;
    const liveCurrent = tracking.currentPosition
      ? { lat: tracking.currentPosition.lat, lng: tracking.currentPosition.lng }
      : null;

    return {
      currentLocation: {
        lat: liveCurrent?.lat ?? currentPoint.lat,
        lng: liveCurrent?.lng ?? currentPoint.lng,
      },
      routePath: {
        id: tracking.route?.id ?? fallback.routePath.id,
        points: routePathPoints,
      },
      routeSegments,
      nextActionPoint: {
        id: 'next-action',
        coordinate: routePathPoints[Math.min(routePathPoints.length - 1, Math.max(0, Math.floor(progress * routePathPoints.length)))] ?? fallback.nextActionPoint.coordinate,
        title: '다음 행동',
        instruction: tracking.nextAction ?? '다음 교통수단을 확인하세요.',
        status,
      },
    };
  }, [progress, resolvedRouteSegments, status, tracking.currentPosition, tracking.nextAction, tracking.route?.id]);

  const detailLines: TransitLineItem[] = useMemo(() => {
    const segments = tracking.route?.mobilitySegments ?? [];
    const selectedSegments = selectedRoute?.segments ?? [];
    const currentIndex = tracking.movement?.currentSegmentIndex ?? 0;
    return segments
      .filter((segment) => segment.mode !== 'car')
      .map((segment, index) => {
        const selectedMatch = selectedSegments[index];
        const stopNameFromSelected = selectedMatch?.endName ?? selectedMatch?.startName;
        const boardingStopName = selectedMatch?.startName ?? stopNameFromSelected;
        const fastExitHint =
          extractFastExitHint(selectedMatch?.startName) ??
          extractFastExitHint(selectedMatch?.endName) ??
          extractFastExitHint(segment.lineLabel);
        return {
          id: `${segment.mode}-${index}`,
          mode: segment.mode as 'walk' | 'bus' | 'subway',
          lineLabel:
            segment.mode === 'walk'
              ? `도보 ${segment.durationMinutes}분`
              : (segment.lineLabel ?? (segment.mode === 'bus' ? '버스' : '지하철')),
          etaText:
            segment.mode === 'walk'
              ? `${segment.durationMinutes}분`
              : `${segment.realtimeInfo?.etaMinutes ?? segment.durationMinutes}분`,
          stopName:
            stopNameFromSelected ?? (segment.mode === 'walk' ? '도보 이동' : '하차 지점 정보 확인중'),
          boardingStopName: boardingStopName ?? undefined,
          fastExitHint: fastExitHint ?? undefined,
          isCurrent: index === currentIndex,
        };
      });
  }, [selectedRoute?.segments, tracking.movement?.currentSegmentIndex, tracking.route?.mobilitySegments]);

  const currentActionText = useMemo(() => {
    const currentIndex = Math.max(0, tracking.movement?.currentSegmentIndex ?? 0);
    const current = detailLines[currentIndex];
    const next = detailLines[currentIndex + 1];
    if (!current) {
      return '경로를 확인하고 이동하세요.';
    }

    if (current.mode === 'walk') {
      if (next?.mode === 'bus') {
        const boardingStop = next.boardingStopName ?? next.stopName;
        return `${boardingStop} 정류장에서\n${normalizeLineLabel(next.lineLabel)} 버스를 타세요`;
      }
      if (next?.mode === 'subway') {
        const boardingStop = next.boardingStopName ?? next.stopName;
        if (next.fastExitHint) {
          return `${boardingStop}역\n${normalizeLineLabel(next.lineLabel)} 탑승 · 빠른 하차 ${next.fastExitHint}`;
        }
        return `${boardingStop}역\n${normalizeLineLabel(next.lineLabel)} 탑승하세요`;
      }
      return `${current.stopName} 방향으로 도보 이동하세요`;
    }
    if (current.mode === 'bus') {
      return `${current.lineLabel} 탑승 후 ${current.stopName}에서 하차하세요`;
    }
    if (current.fastExitHint) {
      return `${current.lineLabel} 탑승 중 · 빠른 하차 ${current.fastExitHint} 쪽으로 이동하세요`;
    }
    return `${current.lineLabel} 탑승 후 ${current.stopName}에서 하차하세요`;
  }, [detailLines, tracking.movement?.currentSegmentIndex]);

  const upcomingAction: UpcomingAction = useMemo(() => {
    const currentIndex = Math.max(0, tracking.movement?.currentSegmentIndex ?? 0);
    const current = detailLines[currentIndex];
    const next = detailLines[currentIndex + 1];
    const defaultEta = minuteTextFromEta(next?.etaText ?? current?.etaText, remainingTimeMinutes);

    if (current?.mode === 'bus' || current?.mode === 'subway') {
      return {
        title: `${minuteTextFromEta(current.etaText, remainingTimeMinutes)} 뒤 하차`,
        subtitle: current.stopName || '하차 지점 확인',
        timeText: arrivalAt ?? '--:--',
      };
    }

    if (next?.mode === 'bus') {
      return {
        title: `${normalizeLineLabel(next.lineLabel)} 버스 ${defaultEta} 뒤 도착`,
        subtitle: `${next.lineLabel} · ${next.stopName}`,
        timeText: arrivalAt ?? '--:--',
      };
    }

    if (next?.mode === 'subway') {
      const fastExit = next.fastExitHint ? ` · 빠른 하차 ${next.fastExitHint}` : '';
      return {
        title: `${defaultEta} 뒤 지하철 도착`,
        subtitle: `${next.lineLabel} · ${next.stopName}${fastExit}`,
        timeText: arrivalAt ?? '--:--',
      };
    }

    if (next) {
      return {
        title: `다음 행동: ${next.lineLabel}`,
        subtitle: next.stopName || '다음 지점 확인',
        timeText: arrivalAt ?? '--:--',
      };
    }

    return {
      title: '곧 도착 예정',
      subtitle: '안내를 계속 확인하세요.',
      timeText: arrivalAt ?? '--:--',
    };
  }, [arrivalAt, detailLines, remainingTimeMinutes, tracking.movement?.currentSegmentIndex]);

  const followupActionText = useMemo(() => {
    const currentIndex = Math.max(0, tracking.movement?.currentSegmentIndex ?? 0);
    const current = detailLines[currentIndex];
    const next = detailLines[currentIndex + 1];
    const nextNext = detailLines[currentIndex + 2];

    if (!current) {
      return '다음 이동 안내를 준비 중입니다.';
    }

    if (current.mode === 'walk') {
      if (next?.mode === 'bus') {
        const dropoff = next.stopName || '하차 정류장';
        return `탑승 후 ${dropoff}에서 하차하세요`;
      }
      if (next?.mode === 'subway') {
        const dropoff = next.stopName || '하차 역';
        const fastExit = next.fastExitHint ? ` · 빠른 하차 ${next.fastExitHint}` : '';
        return `탑승 후 ${dropoff} 하차${fastExit}`;
      }
      return '도보 이동 후 다음 안내를 확인하세요.';
    }

    if (current.mode === 'bus') {
      const dropoff = current.stopName || '다음 정류장';
      if (next?.mode === 'walk') {
        return `${dropoff}에서 하차 후 도보 이동`;
      }
      if (next?.mode === 'subway') {
        const station = next.boardingStopName ?? next.stopName;
        return `${dropoff} 하차 후 ${station}에서 지하철 탑승`;
      }
      return `${dropoff}에서 하차 준비하세요`;
    }

    if (current.mode === 'subway') {
      const dropoff = current.stopName || '다음 역';
      if (current.fastExitHint) {
        return `${dropoff} 하차 예정 · 빠른 하차 ${current.fastExitHint}`;
      }
      if (next?.mode === 'bus') {
        const station = next.boardingStopName ?? next.stopName;
        return `${dropoff} 하차 후 ${station}에서 ${normalizeLineLabel(next.lineLabel)} 버스 탑승`;
      }
      if (next?.mode === 'walk') {
        return `${dropoff}에서 하차 후 도보 이동`;
      }
      if (nextNext) {
        return `하차 후 ${nextNext.stopName} 이동`;
      }
      return `${dropoff}에서 하차 준비하세요`;
    }

    return '다음 이동 안내를 확인하세요.';
  }, [detailLines, remainingTimeMinutes, tracking.movement?.currentSegmentIndex]);

  return {
    status,
    isConnectingSse: tracking.isConnectingSse,
    error: tracking.error,
    nextActionText: currentActionText,
    progressPercent,
    remainingDistanceText: `${remainingDistanceMeters}m`,
    remainingTimeText: `${remainingTimeMinutes}분`,
    currentTimeText: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    arrivalTimeText: `+${remainingTimeMinutes}분`,
    statusMessage:
      status === 'urgent'
        ? '지금 바로 이동 속도를 올려주세요!'
        : status === 'warning'
          ? '조금 서두르면 시간 맞출 수 있어요.'
          : '여유있게 이동하셔도 돼요!',
    upcomingActionTitle: upcomingAction.title,
    upcomingActionSubtitle: upcomingAction.subtitle,
    upcomingActionTimeText: upcomingAction.timeText,
    followupActionText,
    mapData,
    originName: origin?.name ?? origin?.address ?? '출발지',
    destinationName: destination?.name ?? destination?.address ?? '도착지',
    originPin: origin ? { lat: origin.latitude, lng: origin.longitude } : null,
    destinationPin: destination ? { lat: destination.latitude, lng: destination.longitude } : null,
    routePathPoints: mapData.routePath.points,
    detailLines,
  };
}
