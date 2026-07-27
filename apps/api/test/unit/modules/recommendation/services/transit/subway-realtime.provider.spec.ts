import { SafeLogger } from '../../../../../../src/common/logger/safe-logger.service';
import { SubwayRealtimeProvider } from '../../../../../../src/modules/recommendation/services/transit/SubwayRealtimeProvider';

describe('SubwayRealtimeProvider', () => {
  it('marks non-seoul line as unavailable', async () => {
    const provider = new SubwayRealtimeProvider(
      {
        getSubwayArrival: jest.fn(),
      } as never,
      new SafeLogger(),
    );

    const result = await provider.patchSegment({
      mode: 'subway',
      durationMinutes: 12,
      lineLabel: '부산 1호선',
      startName: '서면역',
    });

    expect(result.realtimeStatus).toBe('UNAVAILABLE');
    expect(result.realtimeAdjustedDurationMinutes).toBe(12);
    expect(result.realtimeInfo?.updatedAt).toBeUndefined();
  });

  it('preserves the original data timestamp when returning stale cache', async () => {
    const staleUpdatedAt = '2026-07-21T10:00:00.000Z';
    const provider = new SubwayRealtimeProvider(
      { getSubwayArrival: jest.fn().mockRejectedValue(new Error('timeout')) } as never,
      new SafeLogger(),
    );
    const cache = (provider as unknown as {
      cache: Map<string, { expiresAt: number; value: Record<string, unknown> }>;
    }).cache;
    cache.set('강남:2호선', {
      expiresAt: Date.now() - 1,
      value: {
        mode: 'subway',
        durationMinutes: 15,
        lineLabel: '2호선',
        startName: '강남역',
        realtimeStatus: 'LIVE',
        realtimeInfo: {
          etaMinutes: 3,
          source: 'SEOUL_API',
          updatedAt: staleUpdatedAt,
        },
      },
    });

    const result = await provider.patchSegment({
      mode: 'subway',
      durationMinutes: 15,
      lineLabel: '2호선',
      startName: '강남역',
    });

    expect(result.realtimeStatus).toBe('STALE');
    expect(result.realtimeInfo?.updatedAt).toBe(staleUpdatedAt);
    expect(result.realtimeInfo?.source).toBe('CACHE');
  });

  it('does not expose a fetch-attempt time after an API timeout without cache', async () => {
    const provider = new SubwayRealtimeProvider(
      { getSubwayArrival: jest.fn().mockRejectedValue(new Error('timeout')) } as never,
      new SafeLogger(),
    );

    const result = await provider.patchSegment({
      mode: 'subway',
      durationMinutes: 12,
      lineLabel: '2호선',
      startName: '강남역',
    });

    expect(result.realtimeStatus).toBe('CHECKING');
    expect(result.realtimeInfo?.updatedAt).toBeUndefined();
    expect(result.realtimeInfo?.reasonCode).toBe('SUBWAY_API_TIMEOUT');
  });

  it('does not label an empty public response with the current time', async () => {
    const provider = new SubwayRealtimeProvider(
      { getSubwayArrival: jest.fn().mockResolvedValue({ source: 'cache', arrivalMessage: '' }) } as never,
      new SafeLogger(),
    );

    const result = await provider.patchSegment({
      mode: 'subway',
      durationMinutes: 12,
      lineLabel: '2호선',
      startName: '강남역',
    });

    expect(result.realtimeStatus).toBe('UNAVAILABLE');
    expect(result.realtimeInfo?.updatedAt).toBeUndefined();
    expect(result.realtimeInfo?.reasonCode).toBe('SUBWAY_EMPTY_RESPONSE');
  });
});
