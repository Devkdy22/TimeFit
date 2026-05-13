import { EtaCacheService } from '../../../../src/modules/realtime-bus/cache/eta-cache.service';
import { MappingCacheService } from '../../../../src/modules/realtime-bus/cache/mapping-cache.service';
import { RouteNameMatcher } from '../../../../src/modules/realtime-bus/matchers/route-name.matcher';
import { StationMatcher } from '../../../../src/modules/realtime-bus/matchers/station.matcher';
import { RealtimeBusService } from '../../../../src/modules/realtime-bus/realtime-bus.service';
import type { ResolverResult } from '../../../../src/modules/realtime-bus/realtime-bus.types';

describe('RealtimeBusService', () => {
  function createService(options?: {
    resolverResult?: ResolverResult;
    arrivals?: Record<string, number | null>;
    seoulArsStrictArrivalSec?: number | null;
    seoulArsRelaxedArrivalSec?: number | null;
  }) {
    const resolver = {
      resolve: jest.fn().mockResolvedValue(
        options?.resolverResult ?? {
          stationCandidates: [],
          routeCandidates: [],
          providerCandidates: [],
          diagnostics: {
            providerStationCounts: { SEOUL: 0, GYEONGGI: 0, INCHEON: 0 },
            providerRouteCounts: { SEOUL: 0, GYEONGGI: 0, INCHEON: 0 },
            failedProviders: [],
          },
        },
      ),
    };

    const mappingCache = new MappingCacheService();
    const etaCache = new EtaCacheService();
    const logger = {
      logResolverInput: jest.fn(),
      logProviderStage: jest.fn(),
      logCandidate: jest.fn(),
      logReject: jest.fn(),
      logSelected: jest.fn(),
      logEta: jest.fn(),
      logFail: jest.fn(),
    };

    const createProvider = (type: 'SEOUL' | 'GYEONGGI' | 'INCHEON', priority: number) => ({
      type,
      priority,
      findStationCandidates: jest.fn(),
      findRouteCandidates: jest.fn(),
      getArrival: jest.fn(async (input: { stationId: string; routeId: string }) => {
        const key = `${type}:${input.stationId}:${input.routeId}`;
        const eta = options?.arrivals?.[key];
        if (eta === null || eta === undefined) {
          return null;
        }
        return {
          etaMinutes: eta,
          updatedAt: '2026-04-30T00:00:00.000Z',
          rawStatus: 'LIVE',
        };
      }),
    });

    const seoul = createProvider('SEOUL', 3);
    const gyeonggi = createProvider('GYEONGGI', 2);
    const incheon = createProvider('INCHEON', 1);

    const seoulBusClient = {
      getArrivalByArsId: jest.fn(async (_arsId: string, routeNo?: string) => {
        if (routeNo && options?.seoulArsStrictArrivalSec !== undefined) {
          if (options.seoulArsStrictArrivalSec === null) {
            return null;
          }
          return {
            stationId: _arsId,
            arrivalSec: options.seoulArsStrictArrivalSec,
            delayRisk: 0.1,
            source: 'api',
          };
        }
        if (!routeNo && options?.seoulArsRelaxedArrivalSec !== undefined) {
          if (options.seoulArsRelaxedArrivalSec === null) {
            return null;
          }
          return {
            stationId: _arsId,
            arrivalSec: options.seoulArsRelaxedArrivalSec,
            delayRisk: 0.1,
            source: 'api',
          };
        }
        return null;
      }),
    };

    const service = new RealtimeBusService(
      resolver as never,
      mappingCache,
      etaCache,
      logger as never,
      seoul as never,
      gyeonggi as never,
      incheon as never,
      seoulBusClient as never,
      new RouteNameMatcher(),
      new StationMatcher(),
    );

    return { service, resolver, etaCache };
  }

  const segment = {
    lineLabel: '30번',
    startArsId: '25658',
    startStationId: '177326',
    startName: '천호역(중)',
    startLat: 37.538,
    startLng: 127.123,
  };

  it('"30번"과 "30" normalize 성공 케이스', async () => {
    const { service } = createService({
      resolverResult: {
        stationCandidates: [],
        routeCandidates: [],
        providerCandidates: [
          {
            provider: 'SEOUL',
            station: { provider: 'SEOUL', stationId: 's1', stationName: '천호역', arsId: '25658' },
            route: { provider: 'SEOUL', routeId: 'r1', routeName: '30' },
            score: 92,
          },
        ],
        diagnostics: {
          providerStationCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          providerRouteCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          failedProviders: [],
        },
      },
      arrivals: { 'SEOUL:s1:r1': 4 },
    });

    const result = await service.resolveEta(segment);
    expect(result.status).toBe('LIVE');
    expect(result.provider).toBe('SEOUL');
    expect(result.etaMinutes).toBe(4);
  });

  it('ARS 조회 성공 + routeName 불일치로 ROUTE_MISMATCH', async () => {
    const { service } = createService({
      resolverResult: {
        stationCandidates: [],
        routeCandidates: [],
        providerCandidates: [],
        diagnostics: {
          providerStationCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          providerRouteCounts: { SEOUL: 0, GYEONGGI: 0, INCHEON: 0 },
          failedProviders: [{ provider: 'SEOUL', reason: 'STATION_FOUND_ROUTE_NOT_FOUND' }],
        },
      },
      seoulArsStrictArrivalSec: null,
      seoulArsRelaxedArrivalSec: 180,
    });

    const result = await service.resolveEta(segment);
    expect(result.status).toBe('LIVE');
    expect(result.reasonCode).toBe('ROUTE_MISMATCH');
    expect(result.etaMinutes).toBe(3);
  });

  it('서울 실패 후 경기 후보 성공 케이스', async () => {
    const { service } = createService({
      resolverResult: {
        stationCandidates: [],
        routeCandidates: [],
        providerCandidates: [
          {
            provider: 'SEOUL',
            station: { provider: 'SEOUL', stationId: 's1', stationName: '천호역', arsId: '25658' },
            route: { provider: 'SEOUL', routeId: 'r1', routeName: '30' },
            score: 90,
          },
          {
            provider: 'GYEONGGI',
            station: { provider: 'GYEONGGI', stationId: 'g1', stationName: '천호역', arsId: '25658' },
            route: { provider: 'GYEONGGI', routeId: 'gr1', routeName: '30' },
            score: 81,
          },
        ],
        diagnostics: {
          providerStationCounts: { SEOUL: 1, GYEONGGI: 1, INCHEON: 0 },
          providerRouteCounts: { SEOUL: 1, GYEONGGI: 1, INCHEON: 0 },
          failedProviders: [],
        },
      },
      arrivals: { 'SEOUL:s1:r1': null, 'GYEONGGI:g1:gr1': 5 },
    });

    const result = await service.resolveEta(segment);
    expect(result.provider).toBe('GYEONGGI');
    expect(result.etaMinutes).toBe(5);
  });

  it('모든 provider 후보는 있으나 score threshold 미달 케이스', async () => {
    const { service } = createService({
      resolverResult: {
        stationCandidates: [],
        routeCandidates: [],
        providerCandidates: [
          {
            provider: 'SEOUL',
            station: { provider: 'SEOUL', stationId: 's1', stationName: '천호역' },
            route: { provider: 'SEOUL', routeId: 'r1', routeName: '30' },
            score: 45,
          },
        ],
        diagnostics: {
          providerStationCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          providerRouteCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          failedProviders: [],
        },
      },
      seoulArsStrictArrivalSec: null,
      seoulArsRelaxedArrivalSec: null,
    });

    const result = await service.resolveEta(segment);
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.reasonCode).toBe('SCORE_BELOW_THRESHOLD');
  });

  it('arrival 응답은 있으나 ETA 값이 비어 있는 케이스', async () => {
    const { service } = createService({
      resolverResult: {
        stationCandidates: [],
        routeCandidates: [],
        providerCandidates: [
          {
            provider: 'SEOUL',
            station: { provider: 'SEOUL', stationId: 's1', stationName: '천호역' },
            route: { provider: 'SEOUL', routeId: 'r1', routeName: '30' },
            score: 90,
          },
        ],
        diagnostics: {
          providerStationCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          providerRouteCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
          failedProviders: [],
        },
      },
      arrivals: { 'SEOUL:s1:r1': null },
      seoulArsStrictArrivalSec: null,
      seoulArsRelaxedArrivalSec: null,
    });

    const result = await service.resolveEta(segment);
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.reasonCode).toBe('ROUTE_FOUND_ARRIVAL_EMPTY');
  });

  it('duplicate request dedupe', async () => {
    const resolverResult: ResolverResult = {
      stationCandidates: [],
      routeCandidates: [],
      providerCandidates: [
        {
          provider: 'SEOUL',
          station: { provider: 'SEOUL', stationId: 's1', stationName: '천호역', arsId: '25658' },
          route: { provider: 'SEOUL', routeId: 'r1', routeName: '30' },
          score: 92,
        },
      ],
      diagnostics: {
        providerStationCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
        providerRouteCounts: { SEOUL: 1, GYEONGGI: 0, INCHEON: 0 },
        failedProviders: [],
      },
    };
    const { service, resolver } = createService({
      resolverResult,
      arrivals: { 'SEOUL:s1:r1': 4 },
    });
    resolver.resolve.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(resolverResult), 20)),
    );

    const [a, b] = await Promise.all([service.resolveEta(segment), service.resolveEta(segment)]);
    expect(a.etaMinutes).toBe(4);
    expect(b.etaMinutes).toBe(4);
    expect(resolver.resolve).toHaveBeenCalledTimes(1);
  });
});

