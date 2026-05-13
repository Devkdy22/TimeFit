import { buildRouteComparisonSummary } from '../../../../../src/modules/recommendation/adapters/routeComparisonAdapter';
import type { MobilityRoute } from '../../../../../src/modules/recommendation/types/recommendation.types';

describe('routeComparisonAdapter', () => {
  it('maps route list to summary payload', () => {
    const routes: MobilityRoute[] = [
      {
        id: 'r1',
        name: '1번 경로',
        source: 'api',
        estimatedTravelMinutes: 30,
        realtimeAdjustedDurationMinutes: 36,
        delayRisk: 0.35,
        transferCount: 1,
        walkingMinutes: 7,
        score: 74,
      },
    ];

    const targetArrivalTime = new Date(Date.now() + 50 * 60_000).toISOString();
    const result = buildRouteComparisonSummary(routes, targetArrivalTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.delayMinutes).toBe(6);
    expect(result[0]?.score).toBe(74);
    expect(result[0]?.title).toBe('1번 경로');
  });
});
