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

export interface RouteCandidate {
  id: string;
  name: string;
  source: 'api' | 'fallback';
  routeType?: RouteType;
  busRouteId?: string;
  busStationId?: string;
  estimatedTravelMinutes: number;
  delayRisk: number; // 0 ~ 1
  transferCount: number;
  walkingMinutes: number;
}

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
  dataFreshnessScore: number; // 0 ~ 1
}

export interface RecommendationResult {
  primaryRoute: ScoredRoute;
  alternatives: ScoredRoute[];
  status: ScheduleState;
  nextAction: string;
  confidenceScore: number;
  generatedAt: string;
}
