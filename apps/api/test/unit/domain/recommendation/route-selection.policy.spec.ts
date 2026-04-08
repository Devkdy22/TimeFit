import { selectRecommendation } from '../../../../src/domain/recommendation/route-selection.policy';
import type { ScoredRoute } from '../../../../src/modules/recommendation/types/recommendation.types';

function makeRoute(id: string, score: number, bufferMinutes: number): ScoredRoute {
  return {
    route: {
      id,
      name: id,
      source: 'api',
      estimatedTravelMinutes: 30,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 5,
    },
    departureAt: '2026-04-07T08:00:00.000Z',
    expectedArrivalAt: '2026-04-07T08:50:00.000Z',
    bufferMinutes,
    status: '여유',
    scoreBreakdown: {
      punctuality: 40,
      safety: 25,
      earlyArrivalPenalty: 0,
      transferPenalty: 6,
      walkingPenalty: 2,
      delayPenalty: 1,
      bufferPenalty: 0,
    },
    totalScore: score,
    riskLevel: 'low',
  };
}

describe('selectRecommendation', () => {
  it('selects top route and alternatives', () => {
    const result = selectRecommendation([
      makeRoute('r1', 80, 5),
      makeRoute('r2', 70, 4),
      makeRoute('r3', 66, 3),
      makeRoute('r4', 50, 1),
    ], {
      cacheHitCount: 2,
      cacheTotalCount: 3,
      dataFreshnessScore: 0.8,
    });

    expect(result.primaryRoute.route.id).toBe('r1');
    expect(result.alternatives).toHaveLength(3);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(35);
  });
});
