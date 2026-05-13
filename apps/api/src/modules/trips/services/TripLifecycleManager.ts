import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { EventBus } from '../../../core/EventBus';
import { TripsService } from './trips.service';

@Injectable()
export class TripLifecycleManager implements OnModuleDestroy {
  private readonly inactiveThresholdMs = 10 * 60_000;
  private readonly disconnectedCleanupMs = 2 * 60_000;
  private readonly disconnectedAtByTripId = new Map<string, number>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly tripsService: TripsService,
    private readonly eventBus: EventBus,
    private readonly logger: SafeLogger,
  ) {
    this.timer = setInterval(() => {
      this.cleanup();
    }, 60_000);
    this.timer.unref();
  }

  onSseConnected(tripId: string): void {
    this.disconnectedAtByTripId.delete(tripId);
    this.tripsService.markSseConnected(tripId);
  }

  onSseDisconnected(tripId: string): void {
    this.disconnectedAtByTripId.set(tripId, Date.now());
    this.tripsService.markSseDisconnected(tripId);
  }

  cleanup(): void {
    const now = Date.now();
    const active = this.tripsService.getActiveTripStates();

    for (const state of active) {
      const inactiveDuration = now - state.lastActivityAt;
      const disconnectedAt = this.disconnectedAtByTripId.get(state.tripId);
      const disconnectedDuration = disconnectedAt ? now - disconnectedAt : 0;

      const shouldCleanupByInactive = inactiveDuration >= this.inactiveThresholdMs;
      const shouldCleanupByDisconnect =
        state.sseConnections === 0 && disconnectedAt !== undefined && disconnectedDuration >= this.disconnectedCleanupMs;

      if (!shouldCleanupByInactive && !shouldCleanupByDisconnect) {
        continue;
      }

      this.tripsService.cleanupInactiveTrip(state.tripId);
      this.disconnectedAtByTripId.delete(state.tripId);
      this.eventBus.cleanupTripEvents(state.tripId);
      this.eventBus.cleanupHistory(500);

      this.logger.log(
        {
          event: 'trip.lifecycle.cleanup',
          tripId: state.tripId,
          reason: shouldCleanupByInactive ? 'inactive_timeout' : 'sse_disconnected_timeout',
        },
        TripLifecycleManager.name,
      );
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
