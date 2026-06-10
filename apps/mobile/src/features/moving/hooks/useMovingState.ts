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
  buildRouteSegments as buildResolvedRouteSegments,
  type RawRoute,
} from '../../../utils/buildRouteSegments';
import { buildImmediateFallbackAll } from '../../../utils/buildRouteSegmentsFallback';
import {
  fetchSeoulBusRoutePathGeometry,
  fetchSeoulBusRouteIdsByRouteNo,
  fetchSeoulStationsByRoute,
  type SeoulBusStation,
} from '../../../services/seoulBusApi';
import { getTransitLineStyle } from '../../route-recommend/model/transitLineStyle';
import { subwayColors, subwayLineGeometry } from '../../../data/subwayLineGeometry';
import { sliceSubwayLine } from '../../../data/subwayLineUtils';
import { selectTimeyContextFromTrip } from '../../../domain/timey/timeySelectors';
import { resolveTimeyStateMachine } from '../../../domain/timey/timeyStateMachine';
import { advanceStableTimeySnapshot } from '../../../domain/timey/timeyTransitionGuard';
import type { TimeyContext, TimeyTransitionSnapshot } from '../../../domain/timey/timeyTypes';
import { shouldAutoStartTracking } from './autoStartGuard';

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
type ConfidenceLevel = 'high' | 'medium' | 'low';
interface BusStationAnchorResolution {
  startStation?: SeoulBusStation;
  endStation?: SeoulBusStation;
  confidence: ConfidenceLevel;
  reason: string;
}
interface DirectionalSliceResult {
  points: MapCoordinate[];
  startIndex: number;
  endIndex: number;
  confidence: ConfidenceLevel;
  score: number;
  reason: string;
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

function densifyPolyline(points: MapCoordinate[], maxStepMeters = 80): MapCoordinate[] {
  if (points.length < 2) return points;
  const out: MapCoordinate[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dist = toMeters(a, b);
    if (!Number.isFinite(dist) || dist <= maxStepMeters) {
      out.push(b);
      continue;
    }
    const steps = Math.min(16, Math.floor(dist / maxStepMeters));
    for (let k = 1; k <= steps; k += 1) {
      const t = k / (steps + 1);
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      });
    }
    out.push(b);
  }
  return normalizePathPoints(out);
}

function kNearestPolylineIndices(polyline: MapCoordinate[], target: MapCoordinate, k = 6) {
  const ranked = polyline
    .map((point, index) => ({
      index,
      dist: (point.lat - target.lat) * (point.lat - target.lat) + (point.lng - target.lng) * (point.lng - target.lng),
    }))
    .sort((a, b) => a.dist - b.dist);
  return ranked.slice(0, Math.max(1, k));
}

function polylineLengthMeters(points: MapCoordinate[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += toMeters(points[i - 1], points[i]);
  }
  return total;
}

function distanceToPolylineMeters(polyline: MapCoordinate[], target: MapCoordinate) {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const point of polyline) {
    best = Math.min(best, toMeters(point, target));
  }
  return best;
}

function chooseDirectionalAnchorSlice(
  polyline: MapCoordinate[],
  anchors: MapCoordinate[],
): DirectionalSliceResult | null {
  if (polyline.length < 2 || anchors.length < 2) return null;
  const nearestByAnchor = anchors.map((anchor) => kNearestPolylineIndices(polyline, anchor, 8));
  if (nearestByAnchor.some((cands) => cands.length === 0)) return null;

  type PathCandidate = { indices: number[]; score: number };
  let candidates: PathCandidate[] = nearestByAnchor[0].map((first) => ({
    indices: [first.index],
    score: Math.sqrt(first.dist) * 111000,
  }));

  for (let ai = 1; ai < nearestByAnchor.length; ai += 1) {
    const nextCands = nearestByAnchor[ai];
    const nextPaths: PathCandidate[] = [];
    for (const base of candidates) {
      const prevIdx = base.indices[base.indices.length - 1];
      const prevAnchor = anchors[ai - 1];
      const nowAnchor = anchors[ai];
      const directDistance = Math.max(1, toMeters(prevAnchor, nowAnchor));
      for (const cand of nextCands) {
        if (cand.index < prevIdx) continue;
        const spanStart = Math.min(prevIdx, cand.index);
        const spanEnd = Math.max(prevIdx, cand.index);
        const spanPoints = polyline.slice(spanStart, spanEnd + 1);
        const segmentDistance = Math.max(1, polylineLengthMeters(spanPoints));
        const ratio = segmentDistance / directDistance;
        const anchorDistanceMeters = Math.sqrt(cand.dist) * 111000;
        let penalty = 0;
        if (ratio > 5) penalty += (ratio - 5) * 150;
        if (cand.index === prevIdx) penalty += 150;
        if (cand.index - prevIdx <= 1) penalty += 40;
        if (anchorDistanceMeters > 300) penalty += 300 + (anchorDistanceMeters - 300) * 0.5;
        nextPaths.push({
          indices: [...base.indices, cand.index],
          score: base.score + anchorDistanceMeters + segmentDistance * 0.03 + penalty,
        });
      }
    }
    if (nextPaths.length === 0) return null;
    nextPaths.sort((a, b) => a.score - b.score);
    candidates = nextPaths.slice(0, 18);
  }

  const best = candidates[0];
  if (!best || best.indices.length < 2) return null;
  const rawStart = best.indices[0];
  const rawEnd = best.indices[best.indices.length - 1];
  if (rawStart === rawEnd) return null;
  const startIndex = Math.min(rawStart, rawEnd);
  const endIndex = Math.max(rawStart, rawEnd);
  const points = rawStart <= rawEnd ? polyline.slice(startIndex, endIndex + 1) : polyline.slice(startIndex, endIndex + 1).reverse();
  const avgAnchorDistance = anchors.reduce((sum, anchor) => sum + distanceToPolylineMeters(points, anchor), 0) / anchors.length;
  const confidence: ConfidenceLevel = best.score > 6000 || avgAnchorDistance > 250 ? 'low' : best.score > 2500 ? 'medium' : 'high';
  return {
    points,
    startIndex,
    endIndex,
    confidence,
    score: best.score,
    reason: confidence === 'high' ? 'directional-anchor-fit' : confidence === 'medium' ? 'usable-but-noisy' : 'ratio-or-distance-penalty',
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function chooseMonotonicAnchorSlice(polyline: MapCoordinate[], anchors: MapCoordinate[]): MapCoordinate[] | null {
  const result = chooseDirectionalAnchorSlice(polyline, anchors);
  if (!result || result.confidence === 'low') return null;
  return result.points;
}

function findClosestIndexInRange(
  polyline: MapCoordinate[],
  target: MapCoordinate,
  from: number,
  to: number,
) {
  let minDist = Number.POSITIVE_INFINITY;
  let index = from;
  for (let i = from; i <= to; i += 1) {
    const p = polyline[i];
    const d = (p.lat - target.lat) * (p.lat - target.lat) + (p.lng - target.lng) * (p.lng - target.lng);
    if (d < minDist) {
      minDist = d;
      index = i;
    }
  }
  return { index, dist: minDist };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function slicePolylineByWaypointAnchors(polyline: MapCoordinate[], anchors: MapCoordinate[]): MapCoordinate[] {
  if (polyline.length < 2 || anchors.length < 2) return polyline;

  const forwardIdx: number[] = [];
  let cursor = 0;
  let forwardScore = 0;
  for (const anchor of anchors) {
    const { index, dist } = findClosestIndexInRange(polyline, anchor, cursor, polyline.length - 1);
    forwardIdx.push(index);
    forwardScore += dist;
    cursor = index;
  }

  const backwardIdxDesc: number[] = [];
  cursor = polyline.length - 1;
  let backwardScore = 0;
  for (let i = anchors.length - 1; i >= 0; i -= 1) {
    const anchor = anchors[i];
    const { index, dist } = findClosestIndexInRange(polyline, anchor, 0, cursor);
    backwardIdxDesc.push(index);
    backwardScore += dist;
    cursor = index;
  }
  const backwardIdx = backwardIdxDesc.reverse();

  const chosen = forwardScore <= backwardScore ? forwardIdx : backwardIdx;
  const start = chosen[0];
  const end = chosen[chosen.length - 1];
  if (start <= end) return polyline.slice(start, end + 1);
  return polyline.slice(end, start + 1).reverse();
}

async function resolveWalkGeometry(segment: TrackingSegment) {
  const waypoints = normalizePathPoints([
    ...(segment.pathPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? []),
    ...(typeof segment.startLat === 'number' && typeof segment.startLng === 'number'
      ? [{ lat: segment.startLat, lng: segment.startLng }]
      : []),
    ...(typeof segment.endLat === 'number' && typeof segment.endLng === 'number'
      ? [{ lat: segment.endLat, lng: segment.endLng }]
      : []),
  ]);
  if (waypoints.length >= 3) {
    try {
      const stitched = await buildRoadPolylineFromWaypoints(waypoints, segment.lineLabel ?? 'walk');
      if (stitched.length >= 2) {
        return {
          source: 'kakao-directions',
          points: stitched,
        } as const;
      }
    } catch (error) {
      console.warn('[RouteGeometry][WALK] waypoint stitch failed', { error });
    }
  }

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

function buildStopBasedPolyline(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  const { start, end } = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  return normalizePathPoints([
    ...(start ? [start] : []),
    ...(segment.pathPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? []),
    ...(end ? [end] : []),
  ]);
}

async function buildRoadPolylineFromWaypoints(points: MapCoordinate[], label?: string) {
  const normalized = normalizePathPoints(points);
  if (normalized.length < 2) {
    return normalized;
  }

  const merged: MapCoordinate[] = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const from = normalized[index - 1];
    const to = normalized[index];
    if (toMeters(from, to) <= 3) {
      continue;
    }

    try {
      const road = await fetchKakaoWalkGeometry({
        origin: {
          name: `${label ?? 'segment'}-${index}-from`,
          lat: from.lat,
          lng: from.lng,
        } as RecommendLocation,
        destination: {
          name: `${label ?? 'segment'}-${index}-to`,
          lat: to.lat,
          lng: to.lng,
        } as RecommendLocation,
      });
      const sampled = normalizePathPoints(road);
      if (sampled.length >= 2) {
        if (merged.length === 0) {
          merged.push(...sampled);
        } else {
          merged.push(...sampled.slice(1));
        }
        continue;
      }
    } catch (error) {
      console.warn('[RouteGeometry][ROAD_STITCH] geometry fetch failed', { error, label });
    }

    if (merged.length === 0) {
      merged.push(from, to);
    } else {
      merged.push(to);
    }
  }

  return normalizePathPoints(merged);
}

function inferSubwayPolylineByCoords(
  start: MapCoordinate,
  end: MapCoordinate,
): MapCoordinate[] | null {
  let best: { score: number; polyline: MapCoordinate[] } | null = null;

  for (const stations of Object.values(subwayLineGeometry)) {
    if (!stations || stations.length < 2) {
      continue;
    }
    const line = stations.map((station) => ({ lat: station.lat, lng: station.lng }));
    const startIdx = findClosestIndex(line, start);
    const endIdx = findClosestIndex(line, end);
    const nearestStart = line[startIdx];
    const nearestEnd = line[endIdx];
    const score = toMeters(start, nearestStart) + toMeters(end, nearestEnd);
    const sliced =
      startIdx <= endIdx ? line.slice(startIdx, endIdx + 1) : line.slice(endIdx, startIdx + 1).reverse();
    if (sliced.length < 2) {
      continue;
    }
    if (!best || score < best.score) {
      best = { score, polyline: sliced };
    }
  }

  if (!best) {
    return null;
  }

  // 출/도착역 좌표와 노선 좌표가 너무 멀면 잘못된 추론으로 판단
  if (best.score > 3000) {
    return null;
  }
  return best.polyline;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function resolveRoadFallbackPolyline(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  const { start, end } = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  if (!start || !end || toMeters(start, end) <= 3) {
    return buildSegmentFallbackPolyline(segment, previousSegment, nextSegment);
  }

  try {
    const points = await fetchKakaoWalkGeometry({
      origin: {
        name: segment.startName ?? segment.lineLabel ?? 'segment-start',
        lat: start.lat,
        lng: start.lng,
      } as RecommendLocation,
      destination: {
        name: segment.endName ?? segment.lineLabel ?? 'segment-end',
        lat: end.lat,
        lng: end.lng,
      } as RecommendLocation,
    });
    const normalized = normalizePathPoints(points);
    if (normalized.length >= 2) {
      return normalized;
    }
  } catch (error) {
    console.warn('[RouteGeometry][ROAD_FALLBACK] geometry fetch failed', { error });
  }

  return buildSegmentFallbackPolyline(segment, previousSegment, nextSegment);
}

function normalizeStationToken(value?: string) {
  if (!value) return '';
  return value.replace(/\s+/g, '').replace(/역$/, '').trim();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function stationSeqDirectionScore(startSeq?: number, endSeq?: number) {
  if (!Number.isFinite(startSeq) || !Number.isFinite(endSeq)) return { valid: false, forward: false };
  return {
    valid: startSeq !== endSeq,
    forward: (startSeq ?? 0) < (endSeq ?? 0),
  };
}

function resolveBusStationAnchors(params: {
  stations: SeoulBusStation[];
  startStationId?: string;
  endStationId?: string;
  startName?: string;
  endName?: string;
  fallbackStart?: MapCoordinate;
  fallbackEnd?: MapCoordinate;
  polyline?: MapCoordinate[];
}): BusStationAnchorResolution {
  const { stations, startStationId, endStationId, startName, endName, fallbackStart, fallbackEnd, polyline } = params;
  const normStartId = normalizeStationToken(startStationId);
  const normEndId = normalizeStationToken(endStationId);
  const byStartId = normStartId ? stations.find((s) => normalizeStationToken(s.id) === normStartId) : undefined;
  const byEndId = normEndId ? stations.find((s) => normalizeStationToken(s.id) === normEndId) : undefined;
  if (byStartId && byEndId) {
    return {
      startStation: byStartId,
      endStation: byEndId,
      confidence: byStartId.seq !== byEndId.seq ? 'high' : 'low',
      reason: 'matched-by-station-id',
    };
  }

  const startNameNorm = normalizeStationToken(startName);
  const endNameNorm = normalizeStationToken(endName);
  const startCandidates = stations.filter((s) => normalizeStationToken(s.name) === startNameNorm);
  const endCandidates = stations.filter((s) => normalizeStationToken(s.name) === endNameNorm);
  if (startCandidates.length === 0 || endCandidates.length === 0) {
    return { startStation: byStartId, endStation: byEndId, confidence: 'low', reason: 'missing-name-candidates' };
  }

  let best: { start: SeoulBusStation; end: SeoulBusStation; score: number } | null = null;
  for (const start of startCandidates) {
    for (const end of endCandidates) {
      const seqInfo = stationSeqDirectionScore(start.seq, end.seq);
      let score = 0;
      if (seqInfo.valid) score += 20;
      if (seqInfo.valid && seqInfo.forward) score += 8;
      if (fallbackStart) score += Math.max(0, 25 - toMeters(fallbackStart, { lat: start.lat, lng: start.lng }) / 20);
      if (fallbackEnd) score += Math.max(0, 25 - toMeters(fallbackEnd, { lat: end.lat, lng: end.lng }) / 20);
      if (polyline) {
        score += Math.max(0, 15 - distanceToPolylineMeters(polyline, { lat: start.lat, lng: start.lng }) / 30);
        score += Math.max(0, 15 - distanceToPolylineMeters(polyline, { lat: end.lat, lng: end.lng }) / 30);
      }
      if (start.seq === end.seq) score -= 35;
      if (!best || score > best.score) best = { start, end, score };
    }
  }
  if (!best) return { confidence: 'low', reason: 'no-valid-pair' };
  const startEndDistance = toMeters({ lat: best.start.lat, lng: best.start.lng }, { lat: best.end.lat, lng: best.end.lng });
  const confidence: ConfidenceLevel = best.score >= 55 && startEndDistance > 100 ? 'high' : best.score >= 35 ? 'medium' : 'low';
  return { startStation: best.start, endStation: best.end, confidence, reason: 'best-name-pair' };
}

function scoreBusRouteCandidate(params: {
  resolution: BusStationAnchorResolution;
  fallbackStart?: MapCoordinate;
  fallbackEnd?: MapCoordinate;
}) {
  const { resolution, fallbackStart, fallbackEnd } = params;
  const start = resolution.startStation;
  const end = resolution.endStation;
  let score = 0;
  if (start) score += 40;
  if (end) score += 40;
  const seq = stationSeqDirectionScore(start?.seq, end?.seq);
  if (seq.valid) score += 10;
  if (seq.valid && seq.forward) score += 10;
  const startDist = start && fallbackStart ? toMeters(fallbackStart, { lat: start.lat, lng: start.lng }) : Number.POSITIVE_INFINITY;
  const endDist = end && fallbackEnd ? toMeters(fallbackEnd, { lat: end.lat, lng: end.lng }) : Number.POSITIVE_INFINITY;
  if (startDist <= 300 && endDist <= 300) score += 20;
  if (startDist >= 500 || endDist >= 500) score -= 50;
  if (resolution.confidence === 'low') score -= 40;
  if (resolution.confidence === 'medium') score -= 10;
  return { score, startDist, endDist };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findStationByNameNearest(
  stations: SeoulBusStation[],
  stationName: string | undefined,
  ref?: MapCoordinate,
): SeoulBusStation | undefined {
  const resolution = resolveBusStationAnchors({
    stations,
    startName: stationName,
    endName: stationName,
    fallbackStart: ref,
    fallbackEnd: ref,
  });
  return resolution.startStation;
}

function sliceBusPolylineByStationSeq(
  polyline: MapCoordinate[],
  stations: SeoulBusStation[],
  segment: TrackingSegment,
  fallbackStart?: MapCoordinate,
  fallbackEnd?: MapCoordinate,
) {
  const anchorResolution = resolveBusStationAnchors({
    stations,
    startStationId: segment.startStationId,
    endStationId: segment.endStationId,
    startName: segment.startName,
    endName: segment.endName,
    fallbackStart,
    fallbackEnd,
    polyline,
  });
  if (!anchorResolution.startStation || !anchorResolution.endStation || anchorResolution.confidence === 'low') {
    return {
      points: polyline,
      startIndex: 0,
      endIndex: polyline.length - 1,
      confidence: 'low' as const,
      score: Number.POSITIVE_INFINITY,
      reason: `station-anchor-${anchorResolution.reason}`,
      anchors: anchorResolution,
    };
  }
  const startSeq = anchorResolution.startStation.seq ?? -1;
  const endSeq = anchorResolution.endStation.seq ?? -1;
  if (startSeq < 0 || endSeq < 0 || startSeq === endSeq) {
    return {
      points: polyline,
      startIndex: 0,
      endIndex: polyline.length - 1,
      confidence: 'low' as const,
      score: Number.POSITIVE_INFINITY,
      reason: 'invalid-station-seq',
      anchors: anchorResolution,
    };
  }
  const forward = startSeq < endSeq;
  const anchors = stations
    .filter((station) => (station.seq ?? -1) >= Math.min(startSeq, endSeq) && (station.seq ?? -1) <= Math.max(startSeq, endSeq))
    .sort((a, b) => (forward ? (a.seq ?? 0) - (b.seq ?? 0) : (b.seq ?? 0) - (a.seq ?? 0)))
    .map((station) => ({ lat: station.lat, lng: station.lng }));
  const directional = chooseDirectionalAnchorSlice(polyline, anchors);
  if (!directional) {
    return {
      points: polyline,
      startIndex: 0,
      endIndex: polyline.length - 1,
      confidence: 'low' as const,
      score: Number.POSITIVE_INFINITY,
      reason: 'directional-slice-failed',
      anchors: anchorResolution,
    };
  }
  return { ...directional, anchors: anchorResolution };
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
  function buildBusFallback(source: string, reason: string) {
    const points = buildBusFallbackPolyline(segment, previousSegment, nextSegment);
    console.warn('[RouteGeometry][BUS][FALLBACK]', {
      segmentId,
      lineLabel: segment.lineLabel ?? null,
      busRouteId: segment.busRouteId ?? null,
      selectedRouteId: null,
      source,
      startName: segment.startName ?? null,
      endName: segment.endName ?? null,
      startStationId: segment.startStationId ?? null,
      endStationId: segment.endStationId ?? null,
      matchedStartStation: null,
      matchedEndStation: null,
      stationMatchConfidence: 'low',
      totalPolylinePoints: 0,
      slicedPoints: points.length,
      startToPolylineDistanceMeters: null,
      endToPolylineDistanceMeters: null,
      sliceStartIndex: null,
      sliceEndIndex: null,
      tighteningApplied: false,
      fallbackReason: reason,
    });
    return { source, points } as const;
  }
  function validatePathPointTightening(params: {
    sliced: MapCoordinate[];
    pathPoints: MapCoordinate[];
    tightened: DirectionalSliceResult | null;
  }) {
    const { sliced, pathPoints, tightened } = params;
    if (pathPoints.length < 3) return { ok: false, reason: 'pathPoints-too-few' };
    for (const p of pathPoints) {
      if (distanceToPolylineMeters(sliced, p) > 300) return { ok: false, reason: 'pathPoint-too-far' };
    }
    const indices = pathPoints.map((p) => findClosestIndex(sliced, p));
    for (let i = 1; i < indices.length; i += 1) {
      if (indices[i] < indices[i - 1]) return { ok: false, reason: 'pathPoints-non-monotonic' };
    }
    if (!tightened || tightened.confidence === 'low') return { ok: false, reason: 'tightened-low-confidence' };
    const oldLen = polylineLengthMeters(sliced);
    const newLen = polylineLengthMeters(tightened.points);
    if (newLen < oldLen * 0.3) return { ok: false, reason: 'tightened-too-short' };
    if (newLen > oldLen * 1.2) return { ok: false, reason: 'tightened-too-long' };
    return { ok: true, reason: 'ok' };
  }
  function shouldUseBusRoutePath(params: {
    routeScore: number;
    stationConfidence: ConfidenceLevel;
    sliceConfidence: ConfidenceLevel;
    slicedPoints: number;
  }) {
    const { routeScore, stationConfidence, sliceConfidence, slicedPoints } = params;
    return routeScore >= 50 && stationConfidence !== 'low' && sliceConfidence !== 'low' && slicedPoints >= 8;
  }
  function buildBusFallbackPolyline(
    currentSegment: TrackingSegment,
    prev?: TrackingSegment,
    next?: TrackingSegment,
  ) {
    const fallbackStops = buildStopBasedPolyline(currentSegment, prev, next);
    if (fallbackStops.length >= 2) return fallbackStops;
    return buildSegmentFallbackPolyline(currentSegment, prev, next);
  }

  const segmentId = `${segment.mode}-${segment.lineId ?? segment.busRouteId ?? 'unknown'}-${segment.startName ?? 'start'}-${segment.endName ?? 'end'}`;
  const edge = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  if ((segment.routeGeometry?.length ?? 0) >= 20) {
    console.log('[RouteGeometry][BUS][MATCH]', {
      segmentId,
      lineLabel: segment.lineLabel ?? null,
      busRouteId: segment.busRouteId ?? null,
      selectedRouteId: null,
      source: 'route-geometry',
      startName: segment.startName ?? null,
      endName: segment.endName ?? null,
      startStationId: segment.startStationId ?? null,
      endStationId: segment.endStationId ?? null,
      stationMatchConfidence: 'high',
      totalPolylinePoints: segment.routeGeometry?.length ?? 0,
      slicedPoints: segment.routeGeometry?.length ?? 0,
      startToPolylineDistanceMeters: null,
      endToPolylineDistanceMeters: null,
      sliceStartIndex: null,
      sliceEndIndex: null,
      tighteningApplied: false,
      fallbackReason: null,
    });
    return {
      source: 'route-geometry',
      points: normalizePathPoints(segment.routeGeometry ?? []),
    } as const;
  }

  if (!segment.busRouteId) {
    return buildBusFallback('passStops-fallback', 'missing-busRouteId');
  }

  const candidateIds = [segment.busRouteId];
  if (segment.lineLabel) {
    try {
      const inferredIds = await fetchSeoulBusRouteIdsByRouteNo(segment.lineLabel);
      for (const id of inferredIds) if (!candidateIds.includes(id)) candidateIds.push(id);
    } catch (error) {
      console.warn('[RouteGeometry][BUS] route id lookup failed', { lineLabel: segment.lineLabel, error });
    }
  }

  let selectedRouteId: string | null = null;
  let selectedPayload: BusRouteGeometryPayload | null = null;
  let selectedAnchor: BusStationAnchorResolution | null = null;
  let selectedRouteScore = -9999;
  for (const candidateId of candidateIds.slice(0, 8)) {
    const payload = await fetchBusRouteGeometry(candidateId);
    if (!payload || payload.polyline.length < 10) continue;
    const anchor = resolveBusStationAnchors({
      stations: payload.stations,
      startStationId: segment.startStationId,
      endStationId: segment.endStationId,
      startName: segment.startName,
      endName: segment.endName,
      fallbackStart: edge.start,
      fallbackEnd: edge.end,
      polyline: payload.polyline,
    });
    const scored = scoreBusRouteCandidate({
      resolution: anchor,
      fallbackStart: edge.start,
      fallbackEnd: edge.end,
    });
    if (scored.score > selectedRouteScore) {
      selectedRouteScore = scored.score;
      selectedRouteId = candidateId;
      selectedPayload = payload;
      selectedAnchor = anchor;
    }
  }
  if (!selectedPayload || !selectedRouteId || !selectedAnchor) {
    return buildBusFallback('passStops-fallback', 'no-valid-route-candidate');
  }

  const startStop = selectedAnchor.startStation ? { lat: selectedAnchor.startStation.lat, lng: selectedAnchor.startStation.lng } : edge.start;
  const endStop = selectedAnchor.endStation ? { lat: selectedAnchor.endStation.lat, lng: selectedAnchor.endStation.lng } : edge.end;
  const polyline = selectedPayload.polyline;
  const slicedResult = sliceBusPolylineByStationSeq(polyline, selectedPayload.stations, segment, startStop, endStop);
  let sliced = slicedResult.points;
  let tighteningApplied = false;
  let fallbackReason: string | null = null;
  let sliceStartIndex = slicedResult.startIndex;
  let sliceEndIndex = slicedResult.endIndex;
  let sliceConfidence: ConfidenceLevel = slicedResult.confidence;

  const pathPoints = normalizePathPoints(segment.pathPoints?.map((point) => ({ lat: point.lat, lng: point.lng })) ?? []);
  if (pathPoints.length >= 3 && sliced.length >= 2) {
    const tightened = chooseDirectionalAnchorSlice(sliced, pathPoints);
    const validation = validatePathPointTightening({ sliced, pathPoints, tightened });
    if (validation.ok && tightened) {
      sliced = tightened.points;
      sliceStartIndex = tightened.startIndex;
      sliceEndIndex = tightened.endIndex;
      sliceConfidence = tightened.confidence;
      tighteningApplied = true;
    } else {
      console.warn('[RouteGeometry][BUS][TIGHTEN_SKIP]', { segmentId, reason: validation.reason });
    }
  }

  const startToPolylineDistanceMeters = startStop ? distanceToPolylineMeters(sliced, startStop) : null;
  const endToPolylineDistanceMeters = endStop ? distanceToPolylineMeters(sliced, endStop) : null;
  const useRoutePath = shouldUseBusRoutePath({
    routeScore: selectedRouteScore,
    stationConfidence: selectedAnchor.confidence,
    sliceConfidence,
    slicedPoints: sliced.length,
  });
  if (!useRoutePath) {
    fallbackReason = 'low-route-confidence';
    return buildBusFallback('passStops-fallback', fallbackReason);
  }

  console.log('[RouteGeometry][BUS][MATCH]', {
    segmentId,
    busRouteId: segment.busRouteId,
    selectedRouteId,
    lineLabel: segment.lineLabel ?? null,
    source: 'seoul-bus-routepath',
    startName: segment.startName ?? null,
    endName: segment.endName ?? null,
    startStationId: segment.startStationId ?? null,
    endStationId: segment.endStationId ?? null,
    matchedStartStation: selectedAnchor.startStation
      ? { name: selectedAnchor.startStation.name ?? null, id: selectedAnchor.startStation.id ?? null, seq: selectedAnchor.startStation.seq ?? null }
      : null,
    matchedEndStation: selectedAnchor.endStation
      ? { name: selectedAnchor.endStation.name ?? null, id: selectedAnchor.endStation.id ?? null, seq: selectedAnchor.endStation.seq ?? null }
      : null,
    stationMatchConfidence: selectedAnchor.confidence,
    totalPolylinePoints: polyline.length,
    slicedPoints: sliced.length,
    startToPolylineDistanceMeters,
    endToPolylineDistanceMeters,
    sliceStartIndex,
    sliceEndIndex,
    tighteningApplied,
    fallbackReason,
  });
  console.log('[RouteGeometry][BUS][SLICE]', {
    segmentId,
    sliceStartIndex,
    sliceEndIndex,
    score: slicedResult.score,
    sliceConfidence,
    reason: slicedResult.reason,
    tighteningApplied,
  });

  return {
    source: 'seoul-bus-routepath',
    points: densifyPolyline(sliced, 50),
  } as const;
}

async function resolveSubwayGeometry(
  segment: TrackingSegment,
  previousSegment?: TrackingSegment,
  nextSegment?: TrackingSegment,
) {
  const { start, end } = resolveSegmentEdgePoints(segment, previousSegment, nextSegment);
  const lineName = resolveSubwayLineName(segment.lineLabel);
  const subwayPointsFromStops = normalizePathPoints(
    (segment.pathPoints ?? []).map((point) => ({ lat: point.lat, lng: point.lng })),
  );
  const inferred = start && end ? inferSubwayPolylineByCoords(start, end) : null;

  const withFallbackByPriority = (lineLabel: string) => {
    if (inferred && inferred.length >= 2) {
      return {
        source: 'subway-line-inferred',
        lineName: lineLabel,
        points: inferred,
      } as const;
    }
    if (subwayPointsFromStops.length >= 3) {
      return {
        source: 'subway-pass-stops',
        lineName: lineLabel,
        points: subwayPointsFromStops,
      } as const;
    }
    return {
      source: 'fallback',
      lineName: lineLabel,
      points: buildStopBasedPolyline(segment, previousSegment, nextSegment),
    } as const;
  };

  if (lineName) {
    const sliced = sliceSubwayLine(
      lineName,
      segment.startName,
      segment.endName,
      start,
      end,
    );
    if (sliced.length >= 3) {
      return {
        source: 'subway-line-geometry',
        lineName,
        points: sliced,
      } as const;
    }
    return withFallbackByPriority(lineName);
  }

  if (!lineName) {
    console.warn('[RouteGeometry][SUBWAY][NO_LINE_DATA]', segment.lineLabel ?? null);
    console.warn('[RouteGeometry][SUBWAY][FALLBACK]', segment);
    return withFallbackByPriority(segment.lineLabel ?? '지하철');
  }

  return withFallbackByPriority(segment.lineLabel ?? '지하철');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function buildRouteSegmentsLegacy(
  route: NonNullable<ReturnType<typeof useTripTracking>['route']>,
  options?: { origin?: MapCoordinate | null; destination?: MapCoordinate | null },
) {
  const segments = (route.mobilitySegments ?? []).filter((segment) => segment.mode !== 'car');
  const resolved: MapRouteSegment[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const previousSegment = index > 0 ? segments[index - 1] : undefined;
    const nextSegment = index < segments.length - 1 ? segments[index + 1] : undefined;
    const previousWithEdge =
      previousSegment ??
      (index === 0 && options?.origin
        ? ({
            mode: 'walk',
            durationMinutes: 1,
            endLat: options.origin.lat,
            endLng: options.origin.lng,
          } as TrackingSegment)
        : undefined);
    const nextWithEdge =
      nextSegment ??
      (index === segments.length - 1 && options?.destination
        ? ({
            mode: 'walk',
            durationMinutes: 1,
            startLat: options.destination.lat,
            startLng: options.destination.lng,
          } as TrackingSegment)
        : undefined);
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
          : buildSegmentFallbackPolyline(segment, previousWithEdge, nextWithEdge);
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
      const result = await resolveBusGeometry(segment, previousWithEdge, nextWithEdge);
      const ensuredPoints =
        result.points.length >= 2
          ? result.points
          : buildSegmentFallbackPolyline(segment, previousWithEdge, nextWithEdge);
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

    const result = await resolveSubwayGeometry(segment, previousWithEdge, nextWithEdge);
    const ensuredPoints =
      result.points.length >= 2 ? result.points : buildSegmentFallbackPolyline(segment, previousWithEdge, nextWithEdge);
    console.log('[RouteGeometry][SUBWAY_SOURCE]', {
      segmentId,
      source: result.source,
      lineName: result.lineName,
      pointCount: ensuredPoints.length,
    });
    console.log('[RouteGeometry][SUBWAY]', {
      segmentId,
      source: result.source,
      lineName: result.lineName,
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
  const routeBuildInFlightRef = useRef<string | null>(null);
  const lastCompletedRouteBuildRef = useRef<string | null>(null);
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

    if (
      !shouldAutoStartTracking({
        trackingKey,
        isRunning: tracking.isRunning,
        attemptedKey: autoStartAttemptedKeyRef.current,
      })
    ) {
      return;
    }

    autoStartAttemptedKeyRef.current = trackingKey;
    void tracking.start();
  }, [tracking.isRunning, tracking.start, trackingKey]);

  useEffect(() => {
    const route = selectedRoute?.rawRoute ?? tracking.route;
    if (!route) {
      routeBuildInFlightRef.current = null;
      lastCompletedRouteBuildRef.current = null;
      setResolvedRouteSegments([]);
      return;
    }

    const routeBuildKey = `${route.id ?? 'unknown'}:${(route.mobilitySegments ?? [])
      .map((segment, index) => `${index}:${segment.mode}:${segment.lineLabel ?? ''}:${segment.startName ?? ''}:${segment.endName ?? ''}`)
      .join('|')}`;
    if (routeBuildInFlightRef.current === routeBuildKey || lastCompletedRouteBuildRef.current === routeBuildKey) {
      return;
    }
    routeBuildInFlightRef.current = routeBuildKey;

    let cancelled = false;
    const startedAt = Date.now();
    const run = async () => {
      const nextOrigin = origin ? { lat: origin.latitude, lng: origin.longitude } : null;
      const nextDestination = destination ? { lat: destination.latitude, lng: destination.longitude } : null;
      if (nextOrigin && nextDestination) {
        const immediate = buildImmediateFallbackAll(
          (route.mobilitySegments ?? []).filter((segment) => segment.mode !== 'car'),
          nextOrigin,
          nextDestination,
        );
        console.log('[MovingState][FALLBACK_APPLIED_T0]', {
          routeId: route.id ?? null,
          segmentCount: immediate.length,
          elapsedMs: Date.now() - startedAt,
        });
        setResolvedRouteSegments(immediate);
      }

      const nextSegments = await buildResolvedRouteSegments(
        route as RawRoute,
        {
          origin: nextOrigin ?? movingMapMockData.currentLocation,
          destination: nextDestination ?? movingMapMockData.nextActionPoint.coordinate,
        },
        (progressiveSegments) => {
          if (!cancelled) {
            console.log('[MovingState][PROGRESSIVE_SEGMENTS_UPDATE]', {
              routeId: route.id ?? null,
              segmentCount: progressiveSegments.length,
              elapsedMs: Date.now() - startedAt,
            });
            setResolvedRouteSegments(progressiveSegments);
          }
        },
      );
      if (!cancelled) {
        console.log('[MovingState][FINAL_SEGMENTS_APPLIED]', {
          routeId: route.id ?? null,
          segmentCount: nextSegments.length,
          elapsedMs: Date.now() - startedAt,
        });
        setResolvedRouteSegments(nextSegments);
        lastCompletedRouteBuildRef.current = routeBuildKey;
      }
      routeBuildInFlightRef.current = null;
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [destination, origin, selectedRoute?.id, selectedRoute?.rawRoute, tracking.route?.id, tracking.route]);

  const status = mapApiStatusToUiStatus(tracking.status);
  const progress = Math.max(0, Math.min(1, tracking.movement?.progress ?? 0));
  const progressPercent = Math.round(progress * 100);
  const remainingDistanceMeters = Math.max(0, Math.round(tracking.movement?.distanceFromRouteMeters ?? 0));
  const remainingTimeMinutes = Math.max(1, Math.round((1 - progress) * ((tracking.route?.estimatedTravelMinutes ?? 45))));
  const now = new Date();
  const arrivalDate = new Date(now.getTime() + remainingTimeMinutes * 60 * 1000);
  const currentClock = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const arrivalClock = arrivalDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

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
  const stableTimeySnapshotRef = useRef<TimeyTransitionSnapshot | null>(null);

  const currentSegment = tracking.route?.mobilitySegments?.[tracking.movement?.currentSegmentIndex ?? 0];
  const nextDepartureMinutes = currentSegment?.realtimeInfo?.etaMinutes ?? null;
  const bufferMinutes = selectedRoute?.bufferMinutes;
  const delayMinutes =
    typeof bufferMinutes === 'number' && bufferMinutes < 0 ? Math.abs(Math.round(bufferMinutes)) : 0;
  const tripStatus: string | undefined =
    progress >= 0.995 || remainingTimeMinutes <= 1 ? 'ARRIVED' : undefined;

  const timeyContext: TimeyContext = useMemo(
    () =>
      selectTimeyContextFromTrip({
        trip: tracking,
        bufferMinutes,
        delayMinutes,
        tripStatus,
      }),
    [bufferMinutes, delayMinutes, tracking, tripStatus],
  );
  const rawTimeyState = resolveTimeyStateMachine(timeyContext);
  const stableTimeySnapshot = useMemo(() => {
    const next = advanceStableTimeySnapshot(
      stableTimeySnapshotRef.current,
      rawTimeyState,
      Date.now(),
      timeyContext,
    );
    stableTimeySnapshotRef.current = next;
    return next;
  }, [rawTimeyState, timeyContext]);

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
    currentTimeText: currentClock,
    arrivalTimeText: arrivalClock,
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
    timeyContext: {
      ...timeyContext,
      nextDepartureMinutes,
    },
    timeyState: stableTimeySnapshot.state,
  };
}
