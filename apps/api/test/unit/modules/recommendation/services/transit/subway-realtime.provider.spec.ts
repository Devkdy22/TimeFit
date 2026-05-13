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
  });
});
