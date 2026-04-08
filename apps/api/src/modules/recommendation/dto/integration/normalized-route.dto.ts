import type { RouteCandidate } from '../../types/recommendation.types';

export interface NormalizedRouteDto {
  source: 'api' | 'fallback';
  fetchedAt: string;
  cacheableForMs: number;
  candidates: RouteCandidate[];
}
