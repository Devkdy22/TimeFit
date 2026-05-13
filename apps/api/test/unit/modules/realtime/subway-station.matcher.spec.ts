import { SubwayStationMatcher } from '../../../../../src/modules/realtime/matchers/subway-station.matcher';

describe('SubwayStationMatcher', () => {
  const matcher = new SubwayStationMatcher();

  it('normalizes line name', () => {
    expect(matcher.resolveLine(' 2 호선 ')).toBe('2호선');
  });

  it('normalizes station name', () => {
    expect(matcher.resolveStation('강동역(5호선)')).toBe('강동(5호선)');
  });

  it('supports 수도권 lines', () => {
    expect(matcher.isSupportedLine('수인분당선')).toBe(true);
    expect(matcher.isSupportedLine('신분당선')).toBe(true);
  });
});

