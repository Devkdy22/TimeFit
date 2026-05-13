import type { KakaoMapOverlay } from './transit';
import type { RouteDiagnostics } from '../dto/integration/normalized-route.dto';

export interface LocationInput {
  name: string;
  lat: number;
  lng: number;
}

export type RouteType =
  | 'subway-heavy'
  | 'bus-heavy'
  | 'walking-heavy'
  | 'mixed'
  | 'bus'
  | 'subway'
  | 'car';

export type MobilityMode = 'walk' | 'bus' | 'subway' | 'car';
export type RealtimeStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'DELAYED'
  | 'STALE'
  | 'CHECKING'
  | 'UNAVAILABLE';
export type DelayRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MobilityRealtimeInfo {
  etaMinutes?: number;
  etaSeconds?: number;
  remainingStops?: number;
  trainStatusMessage?: string;
  matchingConfidence?: number;
  reasonCode?: string;
  source?: 'SEOUL_API' | 'GYEONGGI_API' | 'INCHEON_API' | 'CACHE';
  updatedAt?: string;
  debug?: Record<string, unknown>;
}

export interface SegmentCandidate {
  route: string;
  etaMinutes: number;
  etaSeconds?: number;
  direction?: string;
}

export interface MobilitySegment {
  mode: MobilityMode;
  durationMinutes: number;
  lineLabel?: string;
  lineId?: string;
  directionLabel?: string;
  transferTip?: string;
  startName?: string;
  endName?: string;
  startStationId?: string;
  endStationId?: string;
  startArsId?: string;
  endArsId?: string;
  busRouteId?: string;
  stationCount?: number;
  distanceMeters?: number;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  passStops?: string[];
  realtimeAdjustedDurationMinutes?: number;
  realtimeStatus?: RealtimeStatus;
  delayMinutes?: number;
  realtimeInfo?: MobilityRealtimeInfo;
  candidates?: SegmentCandidate[];
}

export interface RouteCandidate {
  id: string;
  name: string;
  source: 'api' | 'fallback';
  routeType?: RouteType;
  mobilityFlow?: string[];
  mobilitySegments?: MobilitySegment[];
  busRouteId?: string;
  busStationId?: string;
  estimatedTravelMinutes: number;
  realtimeAdjustedDurationMinutes?: number;
  delayRisk: number;
  delayRiskLevel?: DelayRiskLevel;
  transferCount: number;
  walkingMinutes: number;
  confidenceScore?: number;
  score?: number;
  realtimeCoverage?: number;
  mapOverlay?: KakaoMapOverlay;
}

export type MobilityRoute = RouteCandidate;

export interface UserPreference {
  prepMinutes: number;
  preferredBufferMinutes: number;
  transferPenaltyWeight: number;
  walkingPenaltyWeight: number;
}

export type ScheduleState = '여유' | '주의' | '긴급' | '위험';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ScoredRoute {
  route: RouteCandidate;
  departureAt: string;
  expectedArrivalAt: string;
  bufferMinutes: number;
  busDelayRisk?: number;
  subwayDelayRisk?: number;
  roadDelayRisk?: number;
  weatherDelayRisk?: number;
  combinedDelayRisk?: number;
  status: ScheduleState;
  scoreBreakdown: {
    punctuality: number;
    safety: number;
    earlyArrivalPenalty: number;
    transferPenalty: number;
    walkingPenalty: number;
    delayPenalty: number;
    bufferPenalty: number;
  };
  totalScore: number;
  riskLevel: RiskLevel;
}

export interface RecommendationSelectionContext {
  cacheHitCount: number;
  cacheTotalCount: number;
  dataFreshnessScore: number;
}

export interface RecommendationResult {
  primaryRoute: ScoredRoute;
  alternatives: ScoredRoute[];
  status: ScheduleState;
  nextAction: string;
  confidenceScore: number;
  generatedAt: string;
  allLate?: boolean;
  walkOnly?: boolean;
  walkMinutes?: number;
  distanceMeters?: number;
  routes?: RouteCandidate[];
  origin?: { name: string; lat: number; lng: number };
  destination?: { name: string; lat: number; lng: number };
}

export interface RecommendationEmptyState {
  code: 'ROUTE_NO_RESULT' | 'ROUTE_EMPTY_AFTER_MAPPING' | 'ROUTE_INVALID_INPUT';
  title: string;
  description: string;
  retryable: boolean;
}

export interface RecommendationEmptyResult {
  routes: RouteCandidate[];
  emptyState: RecommendationEmptyState;
  diagnostics?: RouteDiagnostics;
}

export type RecommendationResponse = RecommendationResult | RecommendationEmptyResult;
