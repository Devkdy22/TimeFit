import { computeTimeFitStatus } from '../../../src/domain/timefitStatus';
import type { MobilityRoute } from '../../../src/modules/recommendation/types/recommendation.types';

describe('computeTimeFitStatus', () => {
  it('returns 주의 when realtimeCoverage is too low even with enough buffer', () => {
    const route: MobilityRoute = {
      id: 'r1',
      name: '테스트',
      source: 'api',
      estimatedTravelMinutes: 20,
      realtimeAdjustedDurationMinutes: 20,
      delayRisk: 0.1,
      transferCount: 0,
      walkingMinutes: 3,
      realtimeCoverage: 0.2,
    };

    const target = new Date(Date.now() + 40 * 60_000).toISOString();
    const result = computeTimeFitStatus(route, target);

    expect(result.status).toBe('주의');
  });

  it('forces 긴급 when first segment is uncertain', () => {
    const route: MobilityRoute = {
      id: 'r2',
      name: '테스트2',
      source: 'api',
      estimatedTravelMinutes: 10,
      realtimeAdjustedDurationMinutes: 10,
      delayRisk: 0.1,
      transferCount: 0,
      walkingMinutes: 2,
      realtimeCoverage: 1,
      mobilitySegments: [
        {
          mode: 'bus',
          durationMinutes: 5,
          realtimeStatus: 'UNAVAILABLE',
          realtimeInfo: { matchingConfidence: 0.2 },
        },
      ],
    };

    const target = new Date(Date.now() + 20 * 60_000).toISOString();
    const result = computeTimeFitStatus(route, target);

    expect(result.status).toBe('긴급');
  });
});
