import { segmentProgress, segmentProgressByLengths } from './routeLineProgress';

describe('segmentProgress', () => {
  it('returns a completed segment ratio for segments before the current one', () => {
    expect(segmentProgress(1, 2.5)).toBe(1);
  });

  it('returns the partial ratio for the segment currently in progress', () => {
    expect(segmentProgress(2, 2.5)).toBe(0.5);
  });

  it('clamps progress before and after the route', () => {
    expect(segmentProgress(0, -1)).toBe(0);
    expect(segmentProgress(3, 8)).toBe(1);
  });

  it('weights completion by rendered segment length instead of segment count', () => {
    expect(segmentProgressByLengths(0, 0.5, [100, 20])).toBe(0.6);
    expect(segmentProgressByLengths(1, 0.5, [100, 20])).toBe(0);
    expect(segmentProgressByLengths(1, 1, [100, 20])).toBe(1);
  });

  it('handles zero-width segments without producing NaN', () => {
    expect(segmentProgressByLengths(0, 0.5, [0, 100])).toBe(1);
    expect(segmentProgressByLengths(1, 0.5, [0, 100])).toBe(0.5);
  });
});
