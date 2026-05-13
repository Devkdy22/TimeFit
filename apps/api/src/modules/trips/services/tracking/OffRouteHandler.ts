import { Injectable } from '@nestjs/common';
import { EventBus } from '../../../../core/EventBus';
import type { MovementTrackingResult } from './MovementTracker';

@Injectable()
export class OffRouteHandler {
  private readonly consecutiveOffRouteByTrip = new Map<string, number>();
  private readonly minConfirmCount = 2;

  constructor(private readonly eventBus: EventBus) {}

  handle(tripId: string, routeId: string, movement: MovementTrackingResult): {
    shouldReroute: boolean;
    forced: boolean;
  } {
    const previous = this.consecutiveOffRouteByTrip.get(tripId) ?? 0;
    const next = movement.isOffRoute ? previous + 1 : 0;
    this.consecutiveOffRouteByTrip.set(tripId, next);

    if (next < this.minConfirmCount) {
      return {
        shouldReroute: false,
        forced: false,
      };
    }

    const forced = next >= 2;
    this.eventBus.emit('OFF_ROUTE', {
      tripId,
      routeId,
      isOffRoute: true,
      consecutiveOffRouteCount: next,
      distanceFromRouteMeters: movement.distanceFromRouteMeters,
    });

    return {
      shouldReroute: true,
      forced,
    };
  }

  reset(tripId: string): void {
    this.consecutiveOffRouteByTrip.delete(tripId);
  }
}
