import { computeTimeFitStatus } from '../../../domain/timefitStatus';
import type { MobilityRoute } from '../types/recommendation.types';

export interface RouteComparisonSummary {
  id: string;
  title: string;
  totalTime: number;
  realtimeTime: number;
  delayMinutes: number;
  delayRisk: number;
  transferCount: number;
  walkMinutes: number;
  status: '여유' | '주의' | '긴급';
  score: number;
}

export function buildRouteComparisonSummary(
  routes: MobilityRoute[],
  targetArrivalTime: string | Date,
): RouteComparisonSummary[] {
  return routes.map((route) => {
    const totalTime = route.estimatedTravelMinutes;
    const realtimeTime = route.realtimeAdjustedDurationMinutes ?? totalTime;
    const delayMinutes = Math.max(0, realtimeTime - totalTime);
    const status = computeTimeFitStatus(route, targetArrivalTime).status;

    return {
      id: route.id,
      title: route.name,
      totalTime,
      realtimeTime,
      delayMinutes,
      delayRisk: route.delayRisk,
      transferCount: route.transferCount,
      walkMinutes: route.walkingMinutes,
      status,
      score: resolveScore(route),
    };
  });
}

function resolveScore(route: MobilityRoute): number {
  if (typeof route.score === 'number' && Number.isFinite(route.score)) {
    return route.score;
  }

  const realtimeTime = route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes;
  const raw = 100 - realtimeTime * 0.8 - route.transferCount * 6 - route.walkingMinutes * 0.4 - route.delayRisk * 20;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
