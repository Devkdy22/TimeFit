import { EventBus } from '../../../../../../src/core/EventBus';
import { OffRouteHandler } from '../../../../../../src/modules/trips/services/tracking/OffRouteHandler';

const movement = {
  currentSegmentIndex: 0,
  progress: 0.4,
  isOffRoute: true,
  nextAction: '도보 이동',
  distanceFromRouteMeters: 140,
  matchingConfidence: 0.3,
};

describe('OffRouteHandler', () => {
  it('emits one reroute signal when consecutive off-route updates reach confirmation', () => {
    const eventBus = new EventBus();
    const handler = new OffRouteHandler(eventBus);
    const listener = jest.fn();
    const unsubscribe = eventBus.subscribe('OFF_ROUTE', listener);

    expect(handler.handle('trip-1', 'route-1', movement).shouldReroute).toBe(false);
    expect(handler.handle('trip-1', 'route-1', movement).shouldReroute).toBe(true);
    expect(handler.handle('trip-1', 'route-1', movement).shouldReroute).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('allows a new reroute signal after the user returns to the route', () => {
    const eventBus = new EventBus();
    const handler = new OffRouteHandler(eventBus);
    const onRoute = { ...movement, isOffRoute: false, distanceFromRouteMeters: 8 };

    handler.handle('trip-1', 'route-1', movement);
    handler.handle('trip-1', 'route-1', movement);
    handler.handle('trip-1', 'route-1', onRoute);
    expect(handler.handle('trip-1', 'route-1', movement).shouldReroute).toBe(false);
    expect(handler.handle('trip-1', 'route-1', movement).shouldReroute).toBe(true);
  });
});
