import type { RouteCandidate } from '../../types/recommendation.types';

export type RouteResolutionStatus =
  | 'OK'
  | 'ROUTE_PROVIDER_DOWN'
  | 'PROVIDER_UNAVAILABLE'
  | 'ROUTE_NOT_FOUND'
  | 'APPLICATION_ERROR'
  | 'INVALID_INPUT';

export interface RouteEmptyState {
  code:
    | 'ROUTE_NOT_FOUND'
    | 'ROUTE_EMPTY_AFTER_MAPPING'
    | 'ROUTE_INVALID_INPUT'
    | 'ROUTE_PROVIDER_DOWN'
    | 'PROVIDER_UNAVAILABLE'
    | 'APPLICATION_ERROR';
  status: Exclude<RouteResolutionStatus, 'OK'>;
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
