import { RealtimeCacheService } from '../../../../../src/modules/realtime/cache/realtime-cache.service';
import { RealtimeLogger } from '../../../../../src/modules/realtime/logs/realtime.logger';
import { BusProvider } from '../../../../../src/modules/realtime/providers/bus.provider';
import { SubwayProvider } from '../../../../../src/modules/realtime/providers/subway.provider';
import { RealtimeService } from '../../../../../src/modules/realtime/realtime.service';
import { EtaFallbackStrategy } from '../../../../../src/modules/realtime/strategies/eta-fallback.strategy';

describe('RealtimeService', () => {
  function createService(overrides?: {
    busResult?: Parameters<BusProvider['getEta']>[0] extends never ? never : any;
    subwayResult?: any;
  }) {
    const cache = new RealtimeCacheService();
    const logger = new RealtimeLogger({ log: jest.fn() } as never);
    const busProvider = {
      getEta: jest.fn().mockResolvedValue(
        overrides?.busResult ?? {
          type: 'BUS',
          status: 'LIVE',
          etaMinutes: 3,
          source: 'SEOUL_API',
          reasonCode: null,
          updatedAt: new Date().toISOString(),
        },
      ),
    } as unknown as BusProvider;
    const subwayProvider = {
      getEta: jest.fn().mockResolvedValue(
        overrides?.subwayResult ?? {
          type: 'SUBWAY',
          status: 'UNAVAILABLE',
          etaMinutes: null,
          source: 'SEOUL_API',
          reasonCode: 'SUBWAY_API_TIMEOUT',
          updatedAt: new Date().toISOString(),
        },
      ),
    } as unknown as SubwayProvider;
    const fallback = new EtaFallbackStrategy();
    const service = new RealtimeService(cache, logger, busProvider, subwayProvider, fallback);
    return { service, cache };
  }

  it('returns LIVE for bus success', async () => {
    const { service } = createService();
    const result = await service.getBusEta({ stationId: '1', routeId: '2' });
    expect(result.status).toBe('LIVE');
    expect(result.etaMinutes).toBe(3);
  });

  it('returns STALE for subway failure when stale exists', async () => {
    const { service, cache } = createService();
    const key = 'SUBWAY:2호선:강동';
    cache.setSuccess(key, {
      type: 'SUBWAY',
      status: 'LIVE',
      etaMinutes: 2,
      source: 'SEOUL_API',
      reasonCode: null,
      updatedAt: new Date().toISOString(),
    });

    // expire fresh manually but keep stale window
    const stale = cache.getStale(key)!;
    (cache as any).entries.set(key, { ...(cache as any).entries.get(key), freshUntil: Date.now() - 1, value: stale });

    const result = await service.getSubwayEta({ line: '2호선', station: '강동' });
    expect(result.status).toBe('STALE');
    expect(result.etaMinutes).toBe(2);
  });

  it('returns UNAVAILABLE after repeated failures without stale', async () => {
    const { service } = createService();
    await service.getSubwayEta({ line: '2호선', station: '강동' });
    await service.getSubwayEta({ line: '2호선', station: '강동' });
    const third = await service.getSubwayEta({ line: '2호선', station: '강동' });
    expect(third.status).toBe('UNAVAILABLE');
  });
});

