import { SafeLogger } from '../../../../../src/common/logger/safe-logger.service';
import { EventBus } from '../../../../../src/core/EventBus';
import type { MobilityRoute } from '../../../../../src/modules/recommendation/types/recommendation.types';
import { TripsService } from '../../../../../src/modules/trips/services/trips.service';
import { TripsRepository } from '../../../../../src/modules/trips/services/trips.repository';
import { MovementTracker } from '../../../../../src/modules/trips/services/tracking/MovementTracker';
import { OffRouteHandler } from '../../../../../src/modules/trips/services/tracking/OffRouteHandler';

describe('TripsService position updates', () => {
  const route: MobilityRoute = {
    id: 'route-1',
    name: '테스트경로',
    source: 'api',
    estimatedTravelMinutes: 20,
    realtimeAdjustedDurationMinutes: 20,
    delayRisk: 0.1,
    delayRiskLevel: 'LOW',
    transferCount: 0,
    walkingMinutes: 20,
    score: 80,
    realtimeCoverage: 1,
    mobilitySegments: [
      {
        mode: 'walk',
        durationMinutes: 20,
        startLat: 37.5,
        startLng: 127,
        endLat: 37.51,
        endLng: 127.01,
      },
    ],
  };

  function createService() {
    const eventBus = new EventBus();
    const service = new TripsService(
      new TripsRepository(),
      { getRouteCandidates: jest.fn() } as never,
      {
        upsertTrackedRoute: jest.fn(),
        startRouteTracking: jest.fn(),
        stopRouteTracking: jest.fn(),
        getTrackedRoute: jest.fn().mockReturnValue(route),
      } as never,
      {
        evaluateReRoute: jest.fn().mockResolvedValue({
          keepCurrent: true,
          nextBestRoute: null,
          reason: 'test',
        }),
      } as never,
      new MovementTracker(),
      {
        smooth: jest.fn((_tripId: string, position: { lat: number; lng: number }) => position),
        reset: jest.fn(),
      } as never,
      new OffRouteHandler(eventBus),
      {
        track: jest.fn(),
        reset: jest.fn(),
      } as never,
      {
        evaluate: jest.fn(),
      } as never,
      eventBus,
      new SafeLogger(),
    );

    const started = service.startTrip({
      route,
      userId: 'u1',
      recommendationId: 'r1',
      targetArrivalTime: new Date(Date.now() + 40 * 60_000).toISOString(),
      currentPosition: { lat: 37.5, lng: 127 },
    });

    return { service, eventBus, tripId: started.tripId };
  }

  it('debounces position updates within 1s', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_700_000_000_000;
    nowSpy.mockImplementation(() => now);

    const { service, tripId } = createService();

    now += 1_100;
    const first = service.updatePosition(tripId, {
      lat: 37.5002,
      lng: 127.0002,
      timestamp: now,
    });
    expect(first.ignored).not.toBe(true);

    now += 200;
    const second = service.updatePosition(tripId, {
      lat: 37.5003,
      lng: 127.0003,
      timestamp: now,
    });

    expect(second.ignored).toBe(true);
    expect(second.reason).toBe('debounced');
    nowSpy.mockRestore();
  });

  it('lowers matchingConfidence when accuracy is poor', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_700_000_100_000;
    nowSpy.mockImplementation(() => now);

    const { service, tripId } = createService();

    now += 1_100;
    const result = service.updatePosition(tripId, {
      lat: 37.5002,
      lng: 127.0002,
      accuracy: 80,
      timestamp: now,
    });

    expect(result.matchingConfidence).toBeLessThan(0.7);
    nowSpy.mockRestore();
  });

  it('emits OFF_ROUTE on two consecutive off-route updates', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_700_000_200_000;
    nowSpy.mockImplementation(() => now);

    const { service, eventBus, tripId } = createService();
    const offRouteSpy = jest.fn();
    const unsubscribe = eventBus.subscribe('OFF_ROUTE', offRouteSpy);

    now += 1_100;
    service.updatePosition(tripId, {
      lat: 37.58,
      lng: 127.05,
      timestamp: now,
    });

    now += 1_100;
    service.updatePosition(tripId, {
      lat: 37.581,
      lng: 127.051,
      timestamp: now,
    });

    expect(offRouteSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    nowSpy.mockRestore();
  });
});
