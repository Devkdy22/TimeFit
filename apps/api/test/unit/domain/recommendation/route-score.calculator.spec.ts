import { calculateRouteScore } from '../../../../src/domain/recommendation/route-score.calculator';
import type {
  RouteCandidate,
  UserPreference,
} from '../../../../src/modules/recommendation/types/recommendation.types';

describe('calculateRouteScore', () => {
  const preference: UserPreference = {
    prepMinutes: 10,
    preferredBufferMinutes: 4,
    transferPenaltyWeight: 1,
    walkingPenaltyWeight: 1,
  };

  const route: RouteCandidate = {
    id: 'a',
    name: 'test',
    source: 'api',
    estimatedTravelMinutes: 30,
    delayRisk: 0,
    transferCount: 1,
    walkingMinutes: 6,
  };

  it('calculates schedule state and score breakdown', () => {
    const arrivalAt = new Date('2026-04-07T09:00:00.000Z');

    const result = calculateRouteScore({ route, arrivalAt, preference });

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.status).toBe('긴급');
    expect(result.scoreBreakdown.transferPenalty).toBe(6);
    expect(result.scoreBreakdown.walkingPenalty).toBe(3);
    expect(result.scoreBreakdown.delayPenalty).toBe(0);
  });

  it('marks delayed routes as high risk', () => {
    const delayedRoute: RouteCandidate = {
      ...route,
      estimatedTravelMinutes: 70,
      delayRisk: 0.8,
    };

    const arrivalAt = new Date('2026-04-07T09:00:00.000Z');

    const result = calculateRouteScore({
      route: delayedRoute,
      arrivalAt,
      preference,
    });

    expect(result.status).toBe('위험');
    expect(result.riskLevel).toBe('high');
  });
});
