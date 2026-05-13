import { SafeLogger } from '../../../../../../src/common/logger/safe-logger.service';
import { ReRoutingEngine } from '../../../../../../src/modules/recommendation/services/transit/ReRoutingEngine';
import type { MobilityRoute } from '../../../../../../src/modules/recommendation/types/recommendation.types';

describe('ReRoutingEngine', () => {
  it('keeps current route when no trigger condition is met', async () => {
    const engine = new ReRoutingEngine(
      new SafeLogger(),
      { emit: jest.fn() } as never,
      {
        fetchTransitRoutes: jest.fn(),
      } as never,
      {
        applyRealtime: jest.fn(),
      } as never,
    );

    const currentRoute: MobilityRoute = {
      id: 'current-1',
      name: '현재 경로',
      source: 'api',
      estimatedTravelMinutes: 30,
      delayRisk: 0.2,
      transferCount: 1,
      walkingMinutes: 6,
      mobilitySegments: [
        {
          mode: 'bus',
          durationMinutes: 10,
          endLat: 37.56,
          endLng: 126.97,
          endName: '시청',
        },
      ],
    };

    const result = await engine.evaluateReRoute(
      currentRoute,
      {
        realtimeSegments: [{ index: 0, realtimeStatus: 'LIVE', delayMinutes: 0 }],
        delayMinutes: 1,
        previousDelayRiskLevel: 'LOW',
        currentDelayRiskLevel: 'LOW',
        bufferMinutes: 6,
      },
      { lat: 37.5, lng: 127.0 },
    );

    expect(result.keepCurrent).toBe(true);
    expect(result.nextBestRoute).toBeNull();
    expect(result.reason).toBe('no_reroute_trigger');
  });

  it('returns reroute candidate when delay spike and better route exists', async () => {
    const engine = new ReRoutingEngine(
      new SafeLogger(),
      { emit: jest.fn() } as never,
      {
        fetchTransitRoutes: jest.fn().mockResolvedValue({
          paths: [
            {
              info: { totalTime: 18 },
              subPath: [
                {
                  trafficType: 2,
                  sectionTime: 18,
                  distance: 3500,
                  lane: [{ busNo: '360' }],
                  startName: '현재 위치',
                  endName: '시청',
                  startY: 37.5,
                  startX: 127.0,
                  endY: 37.56,
                  endX: 126.97,
                },
              ],
            },
          ],
          fetchedAt: new Date().toISOString(),
          cacheableForMs: 30000,
        }),
      } as never,
      {
        applyRealtime: jest.fn(async (routes: MobilityRoute[]) =>
          routes.map((route) => ({
            ...route,
            score: 90,
            realtimeAdjustedDurationMinutes: 20,
            delayRisk: 0.15,
          })),
        ),
      } as never,
    );

    const currentRoute: MobilityRoute = {
      id: 'current-2',
      name: '현재 경로',
      source: 'api',
      estimatedTravelMinutes: 36,
      realtimeAdjustedDurationMinutes: 43,
      delayRisk: 0.7,
      transferCount: 2,
      walkingMinutes: 10,
      score: 50,
      mobilitySegments: [
        {
          mode: 'bus',
          durationMinutes: 15,
          endLat: 37.56,
          endLng: 126.97,
          endName: '시청',
        },
      ],
    };

    const result = await engine.evaluateReRoute(
      currentRoute,
      {
        realtimeSegments: [{ index: 0, realtimeStatus: 'DELAYED', delayMinutes: 7, etaMinutes: 12 }],
        delayMinutes: 7,
        previousDelayRiskLevel: 'LOW',
        currentDelayRiskLevel: 'HIGH',
        bufferMinutes: 1,
      },
      { lat: 37.5, lng: 127.0 },
    );

    expect(result.keepCurrent).toBe(false);
    expect(result.nextBestRoute?.score).toBe(90);
    expect(result.reason).toContain('better_route_found');
  });
});
