import { MovementTracker } from '../../../../../../src/modules/trips/services/tracking/MovementTracker';

describe('MovementTracker', () => {
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
});
