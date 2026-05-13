import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import { EventBus } from '../../../../core/EventBus';
import type { MobilityRoute } from '../../types/recommendation.types';
import { TransitRealtimeOrchestrator } from './TransitRealtimeOrchestrator';

export type RouteTrackingEventType =
  | 'ETA_CHANGED'
  | 'DELAY_INCREASED'
  | 'RISK_LEVEL_CHANGED'
  | 'ROUTE_INVALIDATED';

export interface RouteTrackingEvent {
  type: RouteTrackingEventType;
  routeId: string;
  previousRoute: MobilityRoute;
  nextRoute: MobilityRoute;
  changedAt: string;
  details: string;
}

interface TrackingState {
  route: MobilityRoute;
  timer: NodeJS.Timeout | null;
  targetArrivalAt?: string;
  appState: 'foreground' | 'background';
  pollIntervalMs: number;
}

@Injectable()
export class RealtimeUpdateScheduler implements OnModuleDestroy {
  private readonly eventEmitter = new EventEmitter();
  private readonly trackingByRouteId = new Map<string, TrackingState>();
  private readonly tripIdByRouteId = new Map<string, string>();
  private readonly defaultIntervalMs = 15_000;
  private readonly backgroundIntervalMs = 30_000;

  constructor(
    private readonly logger: SafeLogger,
    private readonly eventBus: EventBus,
    private readonly transitRealtimeOrchestrator: TransitRealtimeOrchestrator,
  ) {}

  registerRoute(route: MobilityRoute, targetArrivalAt?: string): void {
    const existing = this.trackingByRouteId.get(route.id);
    if (!existing) {
      return;
    }

    existing.route = route;
    existing.targetArrivalAt = targetArrivalAt ?? existing.targetArrivalAt;
  }

  upsertTrackedRoute(route: MobilityRoute, tripId?: string, targetArrivalAt?: string): void {
    const previous = this.trackingByRouteId.get(route.id);
    if (previous) {
      previous.route = route;
      previous.targetArrivalAt = targetArrivalAt ?? previous.targetArrivalAt;
      return;
    }

    this.trackingByRouteId.set(route.id, {
      route,
      timer: null,
      targetArrivalAt,
      appState: 'foreground',
      pollIntervalMs: this.defaultIntervalMs,
    });

    if (tripId) {
      this.tripIdByRouteId.set(route.id, tripId);
    }
  }

  startRouteTracking(routeId: string): void {
    const state = this.trackingByRouteId.get(routeId);
    if (!state || state.timer) {
      return;
    }

    state.timer = setInterval(() => {
      void this.refreshRoute(routeId);
    }, state.pollIntervalMs);
    state.timer.unref();
  }

  stopRouteTracking(routeId: string): void {
    const state = this.trackingByRouteId.get(routeId);
    if (!state) {
      return;
    }

    if (state.timer) {
      clearInterval(state.timer);
    }
    this.trackingByRouteId.delete(routeId);
    this.tripIdByRouteId.delete(routeId);
  }

  setAppState(routeId: string, appState: 'foreground' | 'background'): void {
    const state = this.trackingByRouteId.get(routeId);
    if (!state || state.appState === appState) {
      return;
    }

    state.appState = appState;
    const nextInterval = appState === 'background' ? this.backgroundIntervalMs : this.defaultIntervalMs;
    state.pollIntervalMs = nextInterval;

    if (!state.timer) {
      return;
    }

    clearInterval(state.timer);
    state.timer = setInterval(() => {
      void this.refreshRoute(routeId);
    }, nextInterval);
    state.timer.unref();
  }

  onRouteEvent(listener: (event: RouteTrackingEvent) => void): () => void {
    this.eventEmitter.on('route_event', listener);
    return () => {
      this.eventEmitter.off('route_event', listener);
    };
  }

  getTrackedRoute(routeId: string): MobilityRoute | null {
    return this.trackingByRouteId.get(routeId)?.route ?? null;
  }

  async refreshRoute(routeId: string): Promise<MobilityRoute | null> {
    const state = this.trackingByRouteId.get(routeId);
    if (!state) {
      return null;
    }

    const previousRoute = state.route;
    const [nextRoute] = await this.transitRealtimeOrchestrator.applyRealtime([previousRoute]);
    if (!nextRoute) {
      return null;
    }

    state.route = nextRoute;
    const tripId = this.tripIdByRouteId.get(routeId) ?? routeId;
    this.eventBus.emit('ROUTE_UPDATED', {
      tripId,
      routeId,
      reason: 'scheduler_refresh',
    });

    this.detectAndEmitEvents(tripId, previousRoute, nextRoute);
    return nextRoute;
  }

  onModuleDestroy(): void {
    for (const state of this.trackingByRouteId.values()) {
      if (state.timer) {
        clearInterval(state.timer);
      }
    }
    this.trackingByRouteId.clear();
    this.tripIdByRouteId.clear();
  }

  private detectAndEmitEvents(
    tripId: string,
    previousRoute: MobilityRoute,
    nextRoute: MobilityRoute,
  ): void {
    const previousEta = previousRoute.realtimeAdjustedDurationMinutes ?? previousRoute.estimatedTravelMinutes;
    const nextEta = nextRoute.realtimeAdjustedDurationMinutes ?? nextRoute.estimatedTravelMinutes;
    if (Math.abs(nextEta - previousEta) >= 2) {
      this.emitEvent({
        type: 'ETA_CHANGED',
        routeId: nextRoute.id,
        previousRoute,
        nextRoute,
        changedAt: new Date().toISOString(),
        details: `eta_changed:${previousEta}->${nextEta}`,
      });
      this.eventBus.emit('ETA_CHANGED', {
        tripId,
        routeId: nextRoute.id,
        previousEtaMinutes: previousEta,
        nextEtaMinutes: nextEta,
      });
    }

    const previousDelay = Math.max(0, previousEta - previousRoute.estimatedTravelMinutes);
    const nextDelay = Math.max(0, nextEta - nextRoute.estimatedTravelMinutes);
    if (nextDelay - previousDelay >= 3) {
      this.emitEvent({
        type: 'DELAY_INCREASED',
        routeId: nextRoute.id,
        previousRoute,
        nextRoute,
        changedAt: new Date().toISOString(),
        details: `delay_increase:${previousDelay}->${nextDelay}`,
      });
      this.eventBus.emit('DELAY_INCREASED', {
        tripId,
        routeId: nextRoute.id,
        previousDelayMinutes: previousDelay,
        nextDelayMinutes: nextDelay,
      });
    }

    const previousRisk = previousRoute.delayRiskLevel ?? 'LOW';
    const nextRisk = nextRoute.delayRiskLevel ?? 'LOW';
    if (previousRisk !== nextRisk) {
      this.emitEvent({
        type: 'RISK_LEVEL_CHANGED',
        routeId: nextRoute.id,
        previousRoute,
        nextRoute,
        changedAt: new Date().toISOString(),
        details: `risk_level_changed:${previousRisk}->${nextRisk}`,
      });
      this.eventBus.emit('RISK_LEVEL_CHANGED', {
        tripId,
        routeId: nextRoute.id,
        previousRiskLevel: previousRisk,
        nextRiskLevel: nextRisk,
      });
    }

    if ((nextRoute.mobilitySegments ?? []).length === 0) {
      this.emitEvent({
        type: 'ROUTE_INVALIDATED',
        routeId: nextRoute.id,
        previousRoute,
        nextRoute,
        changedAt: new Date().toISOString(),
        details: 'route_has_no_segments',
      });
      this.eventBus.emit('REROUTE_TRIGGERED', {
        tripId,
        routeId: nextRoute.id,
        reason: 'route_invalidated',
        keepCurrent: false,
      });
    }
  }

  private emitEvent(event: RouteTrackingEvent): void {
    this.logger.log(
      {
        event: 'transit.route.tracking.event',
        type: event.type,
        routeId: event.routeId,
        details: event.details,
      },
      RealtimeUpdateScheduler.name,
    );
    this.eventEmitter.emit('route_event', event);
  }
}
