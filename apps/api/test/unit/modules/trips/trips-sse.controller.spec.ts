import { EventBus } from '../../../../src/core/EventBus';
import { TripsController } from '../../../../src/modules/trips/trips.controller';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('TripsController SSE', () => {
  it('emits INIT immediately on connect', async () => {
    const controller = new TripsController(
      {
        getRouteCandidates: jest.fn(),
        startTrip: jest.fn(),
        updatePosition: jest.fn(),
        stopTrip: jest.fn(),
        getTrip: jest.fn(),
        assertCanSubscribeToTrip: jest.fn(),
        markSseConnected: jest.fn(),
        markSseDisconnected: jest.fn(),
        getReplayEvents: jest.fn().mockReturnValue([]),
        getTripSnapshot: jest.fn().mockReturnValue({
          route: { id: 'r1' },
          routeSummary: {},
          movement: {},
          status: '여유',
          timestamp: new Date().toISOString(),
        }),
        getTrackedRouteId: jest.fn().mockReturnValue('r1'),
      } as never,
      new EventBus(),
      {
        onSseConnected: jest.fn(),
        onSseDisconnected: jest.fn(),
      } as never,
      {
        begin: jest.fn(),
        complete: jest.fn(),
        clearPending: jest.fn(),
      } as never,
    );

    const event = await firstValueFrom(
      controller.events({ authUserId: 'u1' } as never, 'trip-1', undefined).pipe(take(1)),
    );
    expect(event.type).toBe('INIT');
  });

  it('replays events after Last-Event-ID', async () => {
    const eventBus = new EventBus();
    const controller = new TripsController(
      {
        getRouteCandidates: jest.fn(),
        startTrip: jest.fn(),
        updatePosition: jest.fn(),
        stopTrip: jest.fn(),
        getTrip: jest.fn(),
        assertCanSubscribeToTrip: jest.fn(),
        markSseConnected: jest.fn(),
        markSseDisconnected: jest.fn(),
        getReplayEvents: jest.fn().mockReturnValue([
          {
            eventId: 12,
            id: 12,
            type: 'ETA_CHANGED',
            eventName: 'ETA_CHANGED',
            timestamp: new Date().toISOString(),
            payload: {
              tripId: 'trip-1',
              routeId: 'r1',
              previousEtaMinutes: 20,
              nextEtaMinutes: 25,
            },
          },
        ]),
        getTripSnapshot: jest.fn().mockReturnValue({
          route: { id: 'r1' },
          routeSummary: {},
          movement: {},
          status: '여유',
          timestamp: new Date().toISOString(),
        }),
        getTrackedRouteId: jest.fn().mockReturnValue('r1'),
      } as never,
      eventBus,
      {
        onSseConnected: jest.fn(),
        onSseDisconnected: jest.fn(),
      } as never,
      {
        begin: jest.fn(),
        complete: jest.fn(),
        clearPending: jest.fn(),
      } as never,
    );

    const received = await firstValueFrom(
      controller.events({ authUserId: 'u1' } as never, 'trip-1', '11').pipe(take(2), toArray()),
    );
    expect(received[0]?.type).toBe('ETA_CHANGED');
    expect(received[1]?.type).toBe('INIT');
  });

  it('cleans up lifecycle and event subscriptions on unsubscribe', async () => {
    jest.useFakeTimers();
    const eventBus = new EventBus();
    const lifecycle = {
      onSseConnected: jest.fn(),
      onSseDisconnected: jest.fn(),
    };
    const controller = new TripsController(
      {
        getRouteCandidates: jest.fn(),
        startTrip: jest.fn(),
        updatePosition: jest.fn(),
        stopTrip: jest.fn(),
        getTrip: jest.fn(),
        assertCanSubscribeToTrip: jest.fn(),
        markSseConnected: jest.fn(),
        markSseDisconnected: jest.fn(),
        getReplayEvents: jest.fn().mockReturnValue([]),
        getTripSnapshot: jest.fn().mockReturnValue({
          route: { id: 'r1' },
          routeSummary: {},
          movement: {},
          status: '여유',
          timestamp: new Date().toISOString(),
        }),
        getTrackedRouteId: jest.fn().mockReturnValue('r1'),
      } as never,
      eventBus,
      lifecycle as never,
      {
        begin: jest.fn(),
        complete: jest.fn(),
        clearPending: jest.fn(),
      } as never,
    );
    const next = jest.fn();

    const subscription = controller
      .events({ authUserId: 'u1' } as never, 'trip-1', undefined)
      .subscribe({ next });

    expect(lifecycle.onSseConnected).toHaveBeenCalledWith('trip-1');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ type: 'INIT' }));

    subscription.unsubscribe();
    expect(lifecycle.onSseDisconnected).toHaveBeenCalledWith('trip-1');

    eventBus.emit('ETA_CHANGED', {
      tripId: 'trip-1',
      routeId: 'r1',
      previousEtaMinutes: 20,
      nextEtaMinutes: 25,
    });
    jest.advanceTimersByTime(25_000);

    expect(next).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
