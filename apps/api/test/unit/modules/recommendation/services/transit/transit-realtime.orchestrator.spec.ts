import { TransitRealtimeOrchestrator } from '../../../../../../src/modules/recommendation/services/transit/TransitRealtimeOrchestrator';
import type { RouteCandidate } from '../../../../../../src/modules/recommendation/types/recommendation.types';

describe('TransitRealtimeOrchestrator', () => {
  it('keeps planned duration when realtime is unavailable', async () => {
    const busRealtimeProvider = {
      patchSegment: jest.fn(async (segment) => ({
        ...segment,
        realtimeStatus: 'UNAVAILABLE' as const,
        realtimeAdjustedDurationMinutes: segment.durationMinutes,
        delayMinutes: 0,
      })),
    };
    const subwayRealtimeProvider = {
      patchSegment: jest.fn(async (segment) => segment),
    };

    const orchestrator = new TransitRealtimeOrchestrator(
      { recommendationTransferBufferMinutes: 4 } as never,
      busRealtimeProvider as never,
      subwayRealtimeProvider as never,
    );

    const route: RouteCandidate = {
      id: 'r1',
      name: '버스 경로',
      source: 'api',
      estimatedTravelMinutes: 25,
      delayRisk: 0.2,
      transferCount: 0,
      walkingMinutes: 3,
      mobilitySegments: [
        { mode: 'walk', durationMinutes: 3 },
        { mode: 'bus', durationMinutes: 22, lineLabel: '360' },
      ],
    };

    const [patched] = await orchestrator.applyRealtime([route]);

    expect(patched.realtimeAdjustedDurationMinutes).toBe(25);
    expect(patched.mobilitySegments?.[1].realtimeStatus).toBe('UNAVAILABLE');
  });
});
