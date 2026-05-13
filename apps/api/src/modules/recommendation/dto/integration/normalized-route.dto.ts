import type { RouteCandidate } from '../../types/recommendation.types';

export type RouteResolutionStatus =
  | 'OK'
  | 'NO_RESULT'
  | 'MAPPING_FAILED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_DOWN'
  | 'INVALID_INPUT';

export interface RouteEmptyState {
  code: 'ROUTE_NO_RESULT' | 'ROUTE_EMPTY_AFTER_MAPPING' | 'ROUTE_INVALID_INPUT';
  title: string;
  description: string;
  retryable: boolean;
}

export interface RouteDiagnostics {
  rawPathCount: number;
  mappedRouteCount: number;
  droppedPathCount: number;
  droppedSegmentCount: number;
  reasons: Record<string, number>;
}

export interface NormalizedRouteDto {
  source: 'api' | 'fallback';
  status: RouteResolutionStatus;
  fetchedAt: string;
  cacheableForMs: number;
  candidates: RouteCandidate[];
  diagnostics?: RouteDiagnostics;
  emptyState?: RouteEmptyState;
  providerErrorCode?: string;
}
