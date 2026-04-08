import { MemoryTtlCacheService } from '../../../../src/common/cache/memory-ttl-cache.service';
import { SafeLogger } from '../../../../src/common/logger/safe-logger.service';
import { RecommendationService } from '../../../../src/modules/recommendation/services/recommendation.service';
import type { NormalizedRouteDto } from '../../../../src/modules/recommendation/dto/integration/normalized-route.dto';

describe('RecommendationService', () => {
  function createService(routeResponse?: NormalizedRouteDto) {
    const memory = new MemoryTtlCacheService();
    const trafficSnapshotRepository = {
      findValidByKey: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const kakaoMapClient = {
      getRouteCandidates: jest
        .fn()
        .mockResolvedValue(
          routeResponse ?? {
            source: 'fallback',
            fetchedAt: '2026-04-07T00:00:00.000Z',
            cacheableForMs: 45_000,
            candidates: [
              {
                id: 'fallback-1',
                name: 'fallback',
                source: 'fallback',
                estimatedTravelMinutes: 22,
                delayRisk: 0.15,
                transferCount: 0,
                walkingMinutes: 2,
              },
              {
                id: 'fallback-2',
                name: 'fallback-2',
                source: 'fallback',
                estimatedTravelMinutes: 24,
                delayRisk: 0.2,
                transferCount: 1,
                walkingMinutes: 3,
              },
              {
                id: 'fallback-3',
                name: 'fallback-3',
                source: 'fallback',
                estimatedTravelMinutes: 26,
                delayRisk: 0.25,
                transferCount: 1,
                walkingMinutes: 4,
              },
            ],
          } satisfies NormalizedRouteDto,
        ),
    };
    const trafficClient = {
      getTrafficDelay: jest.fn().mockResolvedValue({
        source: 'api',
        fetchedAt: '2026-04-07T00:00:00.000Z',
        cacheableForMs: 60_000,
        congestionIndex: 0,
      }),
    };
    const weatherClient = {
      getWeatherDelayFactor: jest.fn().mockResolvedValue({
        source: 'api',
        fetchedAt: '2026-04-07T00:00:00.000Z',
        cacheableForMs: 120_000,
        severityIndex: 0,
      }),
    };
    const seoulBusClient = {
      getNearestStation: jest.fn().mockResolvedValue({
        stationId: '100',
        stationName: '테스트정류장',
      }),
      getArrival: jest.fn().mockResolvedValue({
        stationId: '100',
        arrivalSec: 120,
        delayRisk: 0.05,
        source: 'api',
      }),
    };
    const seoulSubwayClient = {
      getSubwayArrival: jest.fn().mockResolvedValue({
        stationName: 'B',
        arrivalMessage: '곧 도착',
        delayRisk: 0.05,
        source: 'api',
      }),
    };

    const service = new RecommendationService(
      new SafeLogger(),
      memory,
      trafficSnapshotRepository as never,
      kakaoMapClient as never,
      seoulBusClient as never,
      seoulSubwayClient as never,
      trafficClient as never,
      weatherClient as never,
    );

    return { service };
  }

  it('does not select fallback as primary when api routes exist', async () => {
    const { service } = createService();

    const result = await service.recommend({
      origin: { name: 'A', lat: 37.5, lng: 127.0 },
      destination: { name: 'B', lat: 37.6, lng: 127.1 },
      arrivalAt: '2026-04-07T09:00:00.000Z',
      candidateRoutes: [
        {
          id: 'api-low-1',
          name: 'API Low 1',
          source: 'api',
          estimatedTravelMinutes: 32,
          delayRisk: 0.45,
          transferCount: 2,
          walkingMinutes: 10,
        },
        {
          id: 'fallback-high',
          name: 'Fallback High',
          source: 'fallback',
          estimatedTravelMinutes: 20,
          delayRisk: 0.05,
          transferCount: 0,
          walkingMinutes: 1,
        },
        {
          id: 'api-low-2',
          name: 'API Low 2',
          source: 'api',
          estimatedTravelMinutes: 30,
          delayRisk: 0.4,
          transferCount: 2,
          walkingMinutes: 8,
        },
      ],
      userPreference: {
        prepMinutes: 8,
        preferredBufferMinutes: 4,
        transferPenaltyWeight: 1,
        walkingPenaltyWeight: 1,
      },
    });

    expect(result.primaryRoute.route.source).toBe('api');
  });

  it('allows fallback primary when api routes are unavailable', async () => {
    const { service } = createService();

    const result = await service.recommend({
      origin: { name: 'A', lat: 37.5, lng: 127.0 },
      destination: { name: 'B', lat: 37.6, lng: 127.1 },
      arrivalAt: '2026-04-07T09:00:00.000Z',
      userPreference: {
        prepMinutes: 8,
        preferredBufferMinutes: 4,
        transferPenaltyWeight: 1,
        walkingPenaltyWeight: 1,
      },
    });

    expect(result.primaryRoute.route.source).toBe('fallback');
  });
});
