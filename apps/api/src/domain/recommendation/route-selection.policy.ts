import {
  type RecommendationResult,
  type RecommendationSelectionContext,
  type ScoredRoute,
} from '../../modules/recommendation/types/recommendation.types';

export function selectRecommendation(
  scoredRoutes: ScoredRoute[],
  context?: RecommendationSelectionContext,
): RecommendationResult {
  if (scoredRoutes.length === 0) {
    throw new Error('No scored routes to select from');
  }

  const sorted = [...scoredRoutes].sort(compareScoredRoute);

  const primaryRoute = sorted[0];
  const alternatives = sorted.slice(1, 4);

  const second = sorted[1];
  const scoreGap = second
    ? Math.max(0, primaryRoute.totalScore - second.totalScore)
    : Math.max(0, primaryRoute.totalScore);

  const cacheRatio =
    context && context.cacheTotalCount > 0
      ? context.cacheHitCount / context.cacheTotalCount
      : 0.5;
  const freshness = context?.dataFreshnessScore ?? 0.6;

  const confidenceScore = Math.max(
    35,
    Math.min(
      99,
      Math.round(
        45 +
          scoreGap * 2.2 +
          cacheRatio * 20 +
          freshness * 18 +
          (primaryRoute.bufferMinutes >= 2 ? 6 : 0),
      ),
    ),
  );

  const generatedAt = new Date().toISOString();
  const remainingMinutes = Math.floor(
    (new Date(primaryRoute.departureAt).getTime() - new Date(generatedAt).getTime()) / 60_000,
  );

  return {
    primaryRoute,
    alternatives,
    status: primaryRoute.status,
    nextAction: resolveNextActionByRemaining(remainingMinutes),
    confidenceScore,
    generatedAt,
  };
}

function compareScoredRoute(a: ScoredRoute, b: ScoredRoute): number {
  const scoreDiff = b.totalScore - a.totalScore;
  if (Math.abs(scoreDiff) > 6) {
    return scoreDiff;
  }

  const travelA = a.route.realtimeAdjustedDurationMinutes ?? a.route.estimatedTravelMinutes;
  const travelB = b.route.realtimeAdjustedDurationMinutes ?? b.route.estimatedTravelMinutes;
  if (travelA !== travelB) {
    return travelA - travelB;
  }

  if (a.route.walkingMinutes !== b.route.walkingMinutes) {
    return a.route.walkingMinutes - b.route.walkingMinutes;
  }

  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  return b.bufferMinutes - a.bufferMinutes;
}

function resolveNextActionByRemaining(remainingMinutes: number): string {
  if (remainingMinutes > 10) {
    return '아직 여유 있습니다';
  }
  if (remainingMinutes >= 5) {
    return '곧 출발 준비하세요';
  }
  if (remainingMinutes >= 0) {
    return '지금 출발하세요';
  }
  return '지각 위험! 즉시 이동';
}
