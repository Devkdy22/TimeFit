export interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RecommendationSummary {
  arrivalAt: string;
  departureAt: string;
  totalMinutes: number;
  lateRisk: boolean;
}

export type TransportMode = 'walk' | 'transit' | 'car' | 'mixed';

export type RecommendationRiskLevel = 'low' | 'medium' | 'high';
export type RecommendationStatus = '여유' | '주의' | '긴급' | '위험';

export interface RecommendationRouteView {
  id: string;
  name: string;
  source: 'api' | 'fallback';
  departureAt: string;
  expectedArrivalAt: string;
  bufferMinutes: number;
  status: RecommendationStatus;
  score: number;
  riskLevel: RecommendationRiskLevel;
}

export interface RecommendationEngineResult {
  primaryRoute: RecommendationRouteView;
  alternatives: RecommendationRouteView[];
  confidenceScore: number;
  generatedAt: string;
}
