import type { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { RouteDiagnostics } from '../dto/integration/normalized-route.dto';
import type {
  MobilityMode,
  MobilitySegment,
  RouteCandidate,
  RouteType,
  RealtimeStatus,
} from '../types/recommendation.types';
import type { LocationInput } from '../types/recommendation.types';
import type { OdsayPath, OdsaySubPath } from '../types/transit';
import { buildKakaoMapOverlay } from './kakaoMapOverlayAdapter';

const MAX_ROUTE_COUNT = 5;

export const ODSAY_DROP_REASONS = {
  EMPTY_SUB_PATH: 'EMPTY_SUB_PATH',
  UNSUPPORTED_TRAFFIC_TYPE: 'UNSUPPORTED_TRAFFIC_TYPE',
  INVALID_TRAFFIC_TYPE: 'INVALID_TRAFFIC_TYPE',
  MISSING_REQUIRED_TIME: 'MISSING_REQUIRED_TIME',
  MISSING_REQUIRED_DISTANCE: 'MISSING_REQUIRED_DISTANCE',
  ALL_SEGMENTS_DROPPED: 'ALL_SEGMENTS_DROPPED',
  WALK_ONLY_ROUTE: 'WALK_ONLY_ROUTE',
  INVALID_PATH_INFO: 'INVALID_PATH_INFO',
  UNKNOWN_MAPPING_ERROR: 'UNKNOWN_MAPPING_ERROR',
} as const;

export type OdsayDropReason = (typeof ODSAY_DROP_REASONS)[keyof typeof ODSAY_DROP_REASONS];

export interface OdsayMappingResult {
  routes: RouteCandidate[];
  diagnostics: RouteDiagnostics;
}

interface PathMappingSummary {
  route: RouteCandidate | null;
  mappedSegmentCount: number;
  droppedSegmentCount: number;
  dropReasons: OdsayDropReason[];
  originalSubPathCount: number;
}

export function mapResponseToRoutes(
  paths: OdsayPath[],
  origin: LocationInput,
  destination: LocationInput,
  logger?: SafeLogger,
): OdsayMappingResult {
  const diagnostics: RouteDiagnostics = {
    rawPathCount: paths.length,
    mappedRouteCount: 0,
    droppedPathCount: 0,
    droppedSegmentCount: 0,
    reasons: {},
  };

  const routes: RouteCandidate[] = [];

  paths.slice(0, MAX_ROUTE_COUNT).forEach((path, index) => {
    const summary = mapPathToRoute(path, index, origin, destination, logger);
    diagnostics.droppedSegmentCount += summary.droppedSegmentCount;

    summary.dropReasons.forEach((reason) => {
      diagnostics.reasons[reason] = (diagnostics.reasons[reason] ?? 0) + 1;
    });

    const accepted = Boolean(summary.route);
    if (accepted && summary.route) {
      routes.push(summary.route);
    } else {
      diagnostics.droppedPathCount += 1;
      logger?.warn(
        {
          event: 'odsay.route.mapping.path_dropped',
          pathIndex: index,
          pathType: path.pathType ?? null,
          originalSubPathCount: summary.originalSubPathCount,
          mappedSegmentCount: summary.mappedSegmentCount,
          droppedSegmentCount: summary.droppedSegmentCount,
          dropReasons: summary.dropReasons,
          accepted,
        },
        'OdsayRouteAdapter',
      );
    }

    logger?.debug(
      {
        event: 'odsay.route.mapping.summary',
        pathIndex: index,
        pathType: path.pathType ?? null,
        originalSubPathCount: summary.originalSubPathCount,
        mappedSegmentCount: summary.mappedSegmentCount,
        droppedSegmentCount: summary.droppedSegmentCount,
        dropReasons: summary.dropReasons,
        accepted,
      },
      'OdsayRouteAdapter',
    );
  });

  diagnostics.mappedRouteCount = routes.length;

  if (routes.length === 0) {
    logger?.warn(
      {
        event: 'odsay.route.mapping.all_dropped',
        rawPathCount: diagnostics.rawPathCount,
        droppedPathCount: diagnostics.droppedPathCount,
        droppedSegmentCount: diagnostics.droppedSegmentCount,
        reasons: diagnostics.reasons,
      },
      'OdsayRouteAdapter',
    );
  }

  return {
    routes,
    diagnostics,
  };
}

export function mapPathToRoute(
  path: OdsayPath,
  index: number,
  origin: LocationInput,
  destination: LocationInput,
  logger?: SafeLogger,
): PathMappingSummary {
  const subPaths = path.subPath ?? [];
  const dropReasons: OdsayDropReason[] = [];

  if (subPaths.length === 0) {
    dropReasons.push(ODSAY_DROP_REASONS.EMPTY_SUB_PATH);
    return {
      route: null,
      mappedSegmentCount: 0,
      droppedSegmentCount: 0,
      dropReasons,
      originalSubPathCount: 0,
    };
  }

  const segments: MobilitySegment[] = [];
  let droppedSegmentCount = 0;

  subPaths.forEach((subPath) => {
    const mapped = mapSubPathToSegment(subPath, logger);
    if (!mapped.segment) {
      droppedSegmentCount += 1;
      dropReasons.push(mapped.reason);
      return;
    }

    segments.push(mapped.segment);
  });

  if (segments.length === 0) {
    dropReasons.push(ODSAY_DROP_REASONS.ALL_SEGMENTS_DROPPED);
    return {
      route: null,
      mappedSegmentCount: 0,
      droppedSegmentCount,
      dropReasons,
      originalSubPathCount: subPaths.length,
    };
  }

  const transitSegmentCount = segments.filter(
    (segment) => segment.mode === 'bus' || segment.mode === 'subway',
  ).length;

  if (transitSegmentCount === 0) {
    dropReasons.push(ODSAY_DROP_REASONS.WALK_ONLY_ROUTE);
    return {
      route: null,
      mappedSegmentCount: segments.length,
      droppedSegmentCount,
      dropReasons,
      originalSubPathCount: subPaths.length,
    };
  }

  const totalTimeFromInfo = Number(path.info?.totalTime);
  const estimatedTravelMinutes = Number.isFinite(totalTimeFromInfo) && totalTimeFromInfo > 0
    ? totalTimeFromInfo
    : Math.max(3, segments.reduce((sum, segment) => sum + segment.durationMinutes, 0));

  if (!Number.isFinite(estimatedTravelMinutes) || estimatedTravelMinutes <= 0) {
    dropReasons.push(ODSAY_DROP_REASONS.INVALID_PATH_INFO);
    return {
      route: null,
      mappedSegmentCount: segments.length,
      droppedSegmentCount,
      dropReasons,
      originalSubPathCount: subPaths.length,
    };
  }

  const walkingMinutes = segments
    .filter((segment) => segment.mode === 'walk')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);

  const transferCount = Math.max(0, transitSegmentCount - 1);
  const routeType = classifyRouteType(segments, estimatedTravelMinutes);
  const mobilityFlow = segments.map((segment) => toKoreanModeLabel(segment.mode));
  const delayRisk = Math.max(0.05, Math.min(0.95, 0.14 + transferCount * 0.05));
  const realtimeCoverage = 0;

  return {
    route: {
      id: `odsay-${index + 1}`,
      name: `대중교통 추천 ${index + 1}`,
      source: 'api',
      routeType,
      mobilityFlow,
      mobilitySegments: segments,
      estimatedTravelMinutes,
      realtimeAdjustedDurationMinutes: estimatedTravelMinutes,
      delayRisk,
      transferCount,
      walkingMinutes,
      confidenceScore: 0.65,
      score: baseRouteScore(estimatedTravelMinutes, transferCount, walkingMinutes),
      realtimeCoverage,
      mapOverlay: buildKakaoMapOverlay(path, origin, destination),
    },
    mappedSegmentCount: segments.length,
    droppedSegmentCount,
    dropReasons,
    originalSubPathCount: subPaths.length,
  };
}

function mapSubPathToSegment(
  subPath: OdsaySubPath,
  logger?: SafeLogger,
): { segment: MobilitySegment | null; reason: OdsayDropReason } {
  const trafficType = Number(subPath.trafficType);

  if (!Number.isFinite(trafficType)) {
    logger?.warn(
      {
        event: 'odsay.segment.unsupported_traffic_type',
        rawTrafficType: subPath.trafficType,
        normalizedTrafficType: null,
      },
      'OdsayRouteAdapter',
    );
    return { segment: null, reason: ODSAY_DROP_REASONS.INVALID_TRAFFIC_TYPE };
  }

  const mode = mapTrafficTypeToMode(trafficType);
  if (!mode) {
    logger?.warn(
      {
        event: 'odsay.segment.unsupported_traffic_type',
        rawTrafficType: subPath.trafficType,
        normalizedTrafficType: trafficType,
      },
      'OdsayRouteAdapter',
    );
    return { segment: null, reason: ODSAY_DROP_REASONS.UNSUPPORTED_TRAFFIC_TYPE };
  }

  const rawSectionTime = Number(subPath.sectionTime);
  if (!Number.isFinite(rawSectionTime) || rawSectionTime < 0) {
    return { segment: null, reason: ODSAY_DROP_REASONS.MISSING_REQUIRED_TIME };
  }

  const rawDistance = Number(subPath.distance ?? 0);
  if (!Number.isFinite(rawDistance) || rawDistance < 0) {
    return { segment: null, reason: ODSAY_DROP_REASONS.MISSING_REQUIRED_DISTANCE };
  }

  const durationMinutes = Math.max(1, rawSectionTime);
  const lineLabel = resolveLineLabel(subPath, mode);
  const lineId = resolveLineId(subPath, mode);
  const directionLabel = mode === 'subway' ? resolveSubwayDirectionLabel(subPath) : undefined;
  const realtimeStatus: RealtimeStatus = 'SCHEDULED';
  const rawSubPath = subPath as unknown as Record<string, unknown>;
  const firstPassStop = subPath.passStopList?.stations?.[0];
  const startStationId =
    readString(rawSubPath, ['startID', 'stationID', 'startStationID', 'startStationId']) ||
    readString((firstPassStop ?? {}) as Record<string, unknown>, [
      'stationID',
      'stationId',
      'localStationID',
    ]);
  const endStationId = readString(rawSubPath, ['endID', 'stationID2', 'endStationID', 'endStationId']);
  const startArsId =
    readString(rawSubPath, ['startArsID', 'startArsId', 'arsID', 'arsId']) ||
    readString((firstPassStop ?? {}) as Record<string, unknown>, ['arsID', 'arsId']);
  const endArsId = readString(rawSubPath, ['endArsID', 'endArsId']);
  const busRouteId = mode === 'bus' ? resolveBusRouteId(subPath) : undefined;
  const passStops = resolvePassStops(subPath, rawSubPath);

  return {
    reason: ODSAY_DROP_REASONS.UNKNOWN_MAPPING_ERROR,
    segment: {
      mode,
      durationMinutes,
      lineLabel,
      lineId,
      directionLabel,
      startName: subPath.startName,
      endName: subPath.endName,
      startStationId: startStationId || undefined,
      endStationId: endStationId || undefined,
      startArsId: startArsId || undefined,
      endArsId: endArsId || undefined,
      busRouteId,
      stationCount: Number(subPath.stationCount ?? 0),
      distanceMeters: rawDistance,
      startLat: parseCoordinate(subPath.startY),
      startLng: parseCoordinate(subPath.startX),
      endLat: parseCoordinate(subPath.endY),
      endLng: parseCoordinate(subPath.endX),
      passStops,
      realtimeAdjustedDurationMinutes: durationMinutes,
      realtimeStatus,
      delayMinutes: 0,
    },
  };
}

function resolvePassStops(subPath: OdsaySubPath, rawSubPath: Record<string, unknown>): string[] {
  const directStations = subPath.passStopList?.stations ?? [];
  const rawPassStopList = rawSubPath.passStopList as Record<string, unknown> | undefined;
  const rawStations =
    (rawPassStopList?.stations as Array<Record<string, unknown>> | undefined) ??
    (rawPassStopList?.station as Array<Record<string, unknown>> | undefined) ??
    [];

  const rows: Array<Record<string, unknown>> = [
    ...directStations.map((station) => station as Record<string, unknown>),
    ...rawStations,
  ];

  const names = rows
    .map((row) => extractStationName(row))
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  // 비정형 응답 대응: passStopList 하위 모든 노드를 재귀 탐색해 stationName 계열 키를 모은다.
  const recursiveNames = collectStationNames(rawPassStopList ?? {});
  const merged = [...names, ...recursiveNames];

  // 순서 유지 + 중복 제거
  return merged.filter((name, index) => merged.indexOf(name) === index);
}

function extractStationName(row: Record<string, unknown>): string {
  return readString(row, ['stationName', 'stationNm', 'name', 'statnNm', 'stNm']);
}

function collectStationNames(node: unknown): string[] {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const record = value as Record<string, unknown>;
    const name = extractStationName(record).trim();
    if (name) {
      result.push(name);
    }
    Object.values(record).forEach(visit);
  };
  visit(node);
  return result.filter((name, index) => result.indexOf(name) === index);
}

function mapTrafficTypeToMode(trafficType: number): MobilityMode | null {
  if (trafficType === 1) {
    return 'subway';
  }
  if (trafficType === 2) {
    return 'bus';
  }
  if (trafficType === 3) {
    return 'walk';
  }
  return null;
}

function resolveLineLabel(subPath: OdsaySubPath, mode: MobilityMode): string | undefined {
  const lane = subPath.lane?.[0];

  if (mode === 'subway') {
    return lane?.name?.trim() || '지하철';
  }

  if (mode === 'bus') {
    return lane?.busNo?.trim() || lane?.name?.trim() || '버스';
  }

  return undefined;
}

function resolveSubwayDirectionLabel(subPath: OdsaySubPath): string | undefined {
  const lane = subPath.lane?.[0] as Record<string, unknown> | undefined;
  const wayCode = Number(subPath.wayCode);
  if (wayCode === 1) {
    return '상행';
  }
  if (wayCode === 2) {
    return '하행';
  }
  if (wayCode === 3) {
    return '내선';
  }
  if (wayCode === 4) {
    return '외선';
  }

  const laneDirection = lane ? readString(lane, ['updnLine', 'direction', 'way', 'wayName']) : '';
  const compact = `${lane?.name ?? ''} ${laneDirection}`.replace(/\s+/g, '');
  const bound = compact.match(/([가-힣A-Za-z0-9]+행)/)?.[1];
  if (bound) {
    return bound;
  }
  if (compact.includes('상행')) {
    return '상행';
  }
  if (compact.includes('하행')) {
    return '하행';
  }
  if (compact.includes('내선')) {
    return '내선';
  }
  if (compact.includes('외선')) {
    return '외선';
  }
  return undefined;
}

function resolveLineId(subPath: OdsaySubPath, mode: MobilityMode): string | undefined {
  const lane = subPath.lane?.[0] as Record<string, unknown> | undefined;
  if (!lane) {
    return undefined;
  }

  if (mode === 'subway') {
    const lineId = readString(lane, ['subwayCode', 'subwayID', 'subwayId', 'lineId']);
    return lineId || undefined;
  }

  if (mode === 'bus') {
    const lineId = readString(lane, ['busID', 'busLocalBlID', 'busRouteId', 'routeId']);
    return lineId || undefined;
  }

  return undefined;
}

function resolveBusRouteId(subPath: OdsaySubPath): string | undefined {
  const lane = subPath.lane?.[0] as Record<string, unknown> | undefined;
  if (!lane) {
    return undefined;
  }

  const routeId = readString(lane, ['busID', 'busLocalBlID', 'busRouteId', 'routeId']);
  return routeId || undefined;
}

function readString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) {
      continue;
    }
    const normalized = String(value).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return '';
}

function toKoreanModeLabel(mode: MobilityMode): string {
  if (mode === 'subway') {
    return '지하철';
  }
  if (mode === 'bus') {
    return '버스';
  }
  if (mode === 'car') {
    return '차량';
  }
  return '도보';
}

function classifyRouteType(segments: MobilitySegment[], totalMinutes: number): RouteType {
  if (segments.length === 0 || totalMinutes <= 0) {
    return 'mixed';
  }

  const subwayMinutes = segments
    .filter((segment) => segment.mode === 'subway')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const busMinutes = segments
    .filter((segment) => segment.mode === 'bus')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const walkMinutes = segments
    .filter((segment) => segment.mode === 'walk')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0);

  if (subwayMinutes / totalMinutes > 0.6) {
    return 'subway-heavy';
  }
  if (busMinutes / totalMinutes > 0.6) {
    return 'bus-heavy';
  }
  if (walkMinutes / totalMinutes > 0.4) {
    return 'walking-heavy';
  }

  return 'mixed';
}

function baseRouteScore(
  estimatedTravelMinutes: number,
  transferCount: number,
  walkingMinutes: number,
): number {
  const raw = 100 - estimatedTravelMinutes * 0.7 - transferCount * 6 - walkingMinutes * 0.4;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function parseCoordinate(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}
