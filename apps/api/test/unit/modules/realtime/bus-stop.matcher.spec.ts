import { BusStopMatcher } from '../../../../../src/modules/realtime/matchers/bus-stop.matcher';

describe('BusStopMatcher', () => {
  it('returns stationId directly when provided', async () => {
    const matcher = new BusStopMatcher({
      getNearestStation: jest.fn(),
    } as never);

    const result = await matcher.resolve({
      stationId: '12345',
      routeId: '100100',
      routeNo: '341',
    });

    expect(result.stationId).toBe('12345');
    expect(result.routeId).toBe('100100');
    expect(result.routeNo).toBe('341');
  });
});

