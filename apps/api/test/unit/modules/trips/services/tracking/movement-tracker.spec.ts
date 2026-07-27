import { MovementTracker } from '../../../../../../src/modules/trips/services/tracking/MovementTracker';

describe('MovementTracker', () => {
  it('matches against detailed route geometry instead of only segment endpoints', () => {
    const tracker = new MovementTracker();
    const result = tracker.evaluate({
      currentPosition: { lat: 37.505, lng: 127.01 },
      segments: [
        {
          mode: 'bus',
          durationMinutes: 5,
          startLat: 37.5,
          startLng: 127,
          endLat: 37.51,
          endLng: 127.01,
          routeGeometry: [
            { lat: 37.5, lng: 127 },
            { lat: 37.5, lng: 127.01 },
            { lat: 37.51, lng: 127.01 },
          ],
        },
      ],
    });

    expect(result.distanceFromRouteMeters).toBeLessThan(20);
    expect(result.matchedPoint?.lat).toBeCloseTo(37.505, 4);
    expect(result.matchedPoint?.lng).toBeCloseTo(127.01, 4);
  });

  it('detects off-route when distance exceeds 100m', () => {
    const tracker = new MovementTracker();
    const result = tracker.evaluate({
      currentPosition: { lat: 37.58, lng: 127.03 },
      segments: [
        {
          mode: 'walk',
          durationMinutes: 5,
          startLat: 37.5,
          startLng: 127.0,
          endLat: 37.5005,
          endLng: 127.0005,
        },
      ],
    });

    expect(result.isOffRoute).toBe(true);
    expect(result.distanceFromRouteMeters).toBeGreaterThan(100);
  });

  it('does not regress progress because of GPS jitter within the current segment', () => {
    const tracker = new MovementTracker();
    const result = tracker.evaluate({
      currentPosition: { lat: 37.506, lng: 127.0 },
      previousMovement: { currentSegmentIndex: 0, progress: 0.8 },
      segments: [
        {
          mode: 'walk',
          durationMinutes: 5,
          startLat: 37.5,
          startLng: 127.0,
          endLat: 37.51,
          endLng: 127.0,
        },
      ],
    });

    expect(result.currentSegmentIndex).toBe(0);
    expect(result.progress).toBe(0.8);
  });

  it('does not select an earlier segment after the trip has advanced', () => {
    const tracker = new MovementTracker();
    const result = tracker.evaluate({
      currentPosition: { lat: 37.505, lng: 127.0 },
      previousMovement: { currentSegmentIndex: 1, progress: 0.1 },
      segments: [
        {
          mode: 'walk',
          durationMinutes: 5,
          startLat: 37.5,
          startLng: 127.0,
          endLat: 37.51,
          endLng: 127.0,
        },
        {
          mode: 'bus',
          durationMinutes: 5,
          startLat: 37.51,
          startLng: 127.0,
          endLat: 37.52,
          endLng: 127.0,
        },
      ],
    });

    expect(result.currentSegmentIndex).toBe(1);
    expect(result.progress).toBe(0.1);
  });

  it('reports full-route progress separately from current-segment progress', () => {
    const tracker = new MovementTracker();
    const result = tracker.evaluate({
      currentPosition: { lat: 37.515, lng: 127.0 },
      segments: [
        {
          mode: 'walk',
          durationMinutes: 5,
          startLat: 37.5,
          startLng: 127.0,
          endLat: 37.51,
          endLng: 127.0,
        },
        {
          mode: 'bus',
          durationMinutes: 5,
          startLat: 37.51,
          startLng: 127.0,
          endLat: 37.52,
          endLng: 127.0,
        },
      ],
    });

    expect(result.currentSegmentIndex).toBe(1);
    expect(result.progress).toBeCloseTo(0.5, 1);
    expect(result.routeProgress).toBeCloseTo(0.75, 1);
  });
});
