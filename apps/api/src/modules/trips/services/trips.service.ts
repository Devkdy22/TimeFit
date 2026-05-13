import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import {
  type AppEventEnvelope,
  EventBus,
} from '../../../core/EventBus';
import { generateNextAction, type NextActionResult } from '../../../domain/nextAction';
import { computeTimeFitStatus } from '../../../domain/timefitStatus';
import { KakaoMapClient } from '../../recommendation/integrations/kakao-map.client';
import { TimeFitNotifier } from '../../recommendation/services/notification/TimeFitNotifier';
import {
  type CurrentPositionInput,
  type RealtimeStateInput,
  ReRoutingEngine,
} from '../../recommendation/services/transit/ReRoutingEngine';
import { RealtimeUpdateScheduler } from '../../recommendation/services/transit/RealtimeUpdateScheduler';
import type { LocationInput, MobilityRoute } from '../../recommendation/types/recommendation.types';
import { StartTripDto } from '../dto/start-trip.dto';
import { TripPositionDto } from '../dto/trip-position.dto';
import type { TripEntity } from '../types/trip.types';
import { TripsRepository } from './trips.repository';
import { MetricsCollector } from './tracking/MetricsCollector';
import { type MovementTrackingResult, MovementTracker } from './tracking/MovementTracker';
import { OffRouteHandler } from './tracking/OffRouteHandler';
import { PositionSmoother } from './tracking/PositionSmoother';

interface ActiveTripState {
  tripId: string;
  currentRoute: MobilityRoute;
  targetArrivalTime: string;
  currentPosition: CurrentPositionInput;
  status: '여유' | '주의' | '긴급';
  bufferMinutes: number;
  delayMinutes: number;
  nextAction: NextActionResult;
  movement: MovementTrackingResult;
  rerouteCount: number;
  lastActivityAt: number;
  lastPositionTimestamp: number;
  lastPositionReceivedAt: number;
  lastPositionAccuracy?: number;
  lastPositionSpeed?: number;
  lastPositionHeading?: number;
  positionBurstWindow: number[];
  sseConnections: number;
}

@Injectable()
export class TripsService implements OnModuleDestroy {
  private readonly activeTripById = new Map<string, ActiveTripState>();
  private readonly tripIdByRouteId = new Map<string, string>();
  private readonly subscriptions: Array<() => void> = [];
  private readonly minPositionIntervalMs = 1000;
  private readonly burstWindowMs = 10_000;
  private readonly burstMaxCount = 20;

  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly kakaoMapClient: KakaoMapClient,
    private readonly realtimeUpdateScheduler: RealtimeUpdateScheduler,
    private readonly reRoutingEngine: ReRoutingEngine,
    private readonly movementTracker: MovementTracker,
    private readonly positionSmoother: PositionSmoother,
    private readonly offRouteHandler: OffRouteHandler,
    private readonly metricsCollector: MetricsCollector,
    private readonly timeFitNotifier: TimeFitNotifier,
    private readonly eventBus: EventBus,
    private readonly logger: SafeLogger,
  ) {
    this.subscriptions.push(
      this.eventBus.subscribe('ETA_CHANGED', (payload) => {
        void this.handleRouteEvent(payload.tripId, payload.routeId, 'eta_changed');
      }),
    );
    this.subscriptions.push(
      this.eventBus.subscribe('DELAY_INCREASED', (payload) => {
        void this.handleRouteEvent(payload.tripId, payload.routeId, 'delay_increased');
      }),
    );
    this.subscriptions.push(
      this.eventBus.subscribe('RISK_LEVEL_CHANGED', (payload) => {
        void this.handleRouteEvent(payload.tripId, payload.routeId, 'risk_level_changed');
      }),
    );
    this.subscriptions.push(
      this.eventBus.subscribe('REROUTE_TRIGGERED', (payload) => {
        if (payload.reason === 'route_invalidated') {
          void this.handleRouteEvent(payload.tripId, payload.routeId, 'route_invalidated');
        }
      }),
    );
    this.subscriptions.push(
      this.eventBus.subscribe('POSITION_UPDATED', (payload) => {
        this.offRouteHandler.handle(payload.tripId, payload.routeId, payload.movement);
      }),
    );
    this.subscriptions.push(
      this.eventBus.subscribe('OFF_ROUTE', (payload) => {
        void this.handleOffRoute(payload.tripId, payload.routeId);
      }),
    );
  }

  async getRouteCandidates(origin: LocationInput, destination: LocationInput) {
    return this.kakaoMapClient.getRouteCandidates(origin, destination);
  }

  startTrip(input: StartTripDto): {
    tripId: string;
    routeId: string;
    status: '여유' | '주의' | '긴급';
    bufferMinutes: number;
    targetArrivalTime: string;
  } {
    const route = input.route;
    if (!route) {
      throw new Error('route is required');
    }

    const startedAt = input.startedAt ?? new Date().toISOString();
    const targetArrivalTime = input.targetArrivalTime ?? input.arrivalAt ?? startedAt;
    const status = computeTimeFitStatus(route, targetArrivalTime);

    const trip = this.tripsRepository.create({
      userId: input.userId ?? 'anonymous',
      recommendationId: input.recommendationId ?? route.id,
      startedAt,
      currentRoute: route.id,
      departureAt: input.departureAt,
      arrivalAt: targetArrivalTime,
      expoPushToken: input.expoPushToken,
      plannedDurationMinutes:
        input.plannedDurationMinutes ??
        route.realtimeAdjustedDurationMinutes ??
        route.estimatedTravelMinutes,
      originLat: input.currentPosition?.lat ?? route.mobilitySegments?.[0]?.startLat,
      originLng: input.currentPosition?.lng ?? route.mobilitySegments?.[0]?.startLng,
      destinationLat: route.mobilitySegments?.[route.mobilitySegments.length - 1]?.endLat,
      destinationLng: route.mobilitySegments?.[route.mobilitySegments.length - 1]?.endLng,
      stationName: route.mobilitySegments?.[0]?.startName,
    });

    this.registerActiveTrip(
      trip,
      route,
      targetArrivalTime,
      status.status,
      status.bufferMinutes,
      input.currentPosition,
    );

    this.realtimeUpdateScheduler.upsertTrackedRoute(route, trip.id, targetArrivalTime);
    this.realtimeUpdateScheduler.startRouteTracking(route.id);

    this.eventBus.emit('ROUTE_STARTED', {
      tripId: trip.id,
      routeId: route.id,
      targetArrivalTime,
    });

    this.eventBus.emit('STATUS_CHANGED', {
      tripId: trip.id,
      routeId: route.id,
      previousStatus: status.status,
      nextStatus: status.status,
      bufferMinutes: status.bufferMinutes,
    });

    return {
      tripId: trip.id,
      routeId: route.id,
      status: status.status,
      bufferMinutes: status.bufferMinutes,
      targetArrivalTime,
    };
  }

  updatePosition(tripId: string, input: TripPositionDto): {
    currentSegmentIndex: number;
    progress: number;
    isOffRoute: boolean;
    nextAction: string;
    distanceFromRouteMeters: number;
    matchingConfidence: number;
    ignored?: boolean;
    reason?: string;
  } {
    const active = this.activeTripById.get(tripId);
    if (!active) {
      throw new Error('trip_not_tracking');
    }

    if (!this.isValidPosition(input.lat, input.lng)) {
      return {
        ...active.movement,
        ignored: true,
        reason: 'invalid_position',
      };
    }

    const now = Date.now();
    if (input.timestamp <= active.lastPositionTimestamp) {
      return {
        ...active.movement,
        ignored: true,
        reason: 'stale_timestamp',
      };
    }

    if (input.timestamp - active.lastPositionTimestamp < this.minPositionIntervalMs) {
      return {
        ...active.movement,
        ignored: true,
        reason: 'debounced',
      };
    }

    if (now - active.lastPositionReceivedAt < this.minPositionIntervalMs) {
      return {
        ...active.movement,
        ignored: true,
        reason: 'rate_limited',
      };
    }

    const windowStart = now - this.burstWindowMs;
    active.positionBurstWindow = active.positionBurstWindow.filter((ts) => ts >= windowStart);
    if (active.positionBurstWindow.length >= this.burstMaxCount) {
      return {
        ...active.movement,
        ignored: true,
        reason: 'burst_limited',
      };
    }

    active.positionBurstWindow.push(now);
    active.currentPosition = this.positionSmoother.smooth(tripId, {
      lat: input.lat,
      lng: input.lng,
    });
    active.lastPositionTimestamp = input.timestamp;
    active.lastPositionReceivedAt = now;
    active.lastPositionAccuracy = input.accuracy;
    active.lastPositionSpeed = input.speed;
    active.lastPositionHeading = input.heading;
    active.lastActivityAt = now;

    const movement = this.movementTracker.evaluate({
      currentPosition: active.currentPosition,
      segments: active.currentRoute.mobilitySegments ?? [],
    });

    const accuracy = input.accuracy ?? 0;
    if (accuracy > 50) {
      movement.matchingConfidence = Number((movement.matchingConfidence * 0.5).toFixed(3));
    }
    if ((input.speed ?? 0) >= 7 && movement.nextAction === '도보 이동') {
      movement.nextAction = '버스 탑승';
      movement.matchingConfidence = Number((movement.matchingConfidence * 0.85).toFixed(3));
    }

    active.movement = movement;

    const segment = active.currentRoute.mobilitySegments?.[movement.currentSegmentIndex];
    active.nextAction = generateNextAction(segment, movement.progress, segment?.realtimeInfo, {
      departureInMinutes: active.bufferMinutes,
    });

    this.eventBus.emit('POSITION_UPDATED', {
      tripId,
      routeId: active.currentRoute.id,
      timestamp: input.timestamp,
      movement,
    });

    return movement;
  }

  stopTrip(tripId: string): { stopped: boolean; tripId: string } {
    const active = this.activeTripById.get(tripId);
    if (!active) {
      return { stopped: false, tripId };
    }

    this.realtimeUpdateScheduler.stopRouteTracking(active.currentRoute.id);
    this.tripIdByRouteId.delete(active.currentRoute.id);
    this.activeTripById.delete(tripId);
    this.offRouteHandler.reset(tripId);
    this.positionSmoother.reset(tripId);
    this.metricsCollector.reset(active.currentRoute.id);
    this.tripsRepository.updateStatus(tripId, 'arrived');
    this.eventBus.cleanupTripEvents(tripId);

    return {
      stopped: true,
      tripId,
    };
  }

  getTrip(tripId: string): {
    trip: TripEntity;
    route: MobilityRoute | null;
    status: '여유' | '주의' | '긴급' | null;
    bufferMinutes: number | null;
    nextAction: NextActionResult | null;
    movement: MovementTrackingResult | null;
  } {
    const trip = this.tripsRepository.findById(tripId);
    const active = this.activeTripById.get(tripId);

    return {
      trip,
      route: active?.currentRoute ?? null,
      status: active?.status ?? null,
      bufferMinutes: active?.bufferMinutes ?? null,
      nextAction: active?.nextAction ?? null,
      movement: active?.movement ?? null,
    };
  }

  getTripSnapshot(tripId: string): {
    route: MobilityRoute;
    routeSummary: {
      realtimeAdjustedDurationMinutes: number;
      delayMinutes: number;
      delayRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      score: number;
      status: '여유' | '주의' | '긴급';
    };
    movement: {
      currentSegmentIndex: number;
      progress: number;
      nextAction: string;
      distanceFromRouteMeters: number;
      isOffRoute: boolean;
      matchingConfidence: number;
    };
    status: '여유' | '주의' | '긴급';
    timestamp: string;
  } {
    const active = this.activeTripById.get(tripId);
    if (!active) {
      throw new Error('trip_not_tracking');
    }

    return {
      route: active.currentRoute,
      routeSummary: this.buildRouteSummary(active),
      movement: {
        currentSegmentIndex: active.movement.currentSegmentIndex,
        progress: active.movement.progress,
        nextAction: active.nextAction.title,
        distanceFromRouteMeters: active.movement.distanceFromRouteMeters,
        isOffRoute: active.movement.isOffRoute,
        matchingConfidence: active.movement.matchingConfidence,
      },
      status: active.status,
      timestamp: new Date().toISOString(),
    };
  }

  getReplayEvents(tripId: string, lastEventId: string | undefined): Array<AppEventEnvelope> {
    const parsed = Number(lastEventId ?? NaN);
    if (!Number.isFinite(parsed)) {
      return [];
    }

    return this.eventBus.getEventsAfter(parsed, {
      eventNames: [
        'ETA_CHANGED',
        'STATUS_CHANGED',
        'ROUTE_SWITCHED',
        'POSITION_UPDATED',
        'OFF_ROUTE',
      ],
      filter: (envelope) => {
        const payload = envelope.payload as { tripId?: string };
        return payload.tripId === tripId;
      },
      limit: 200,
    });
  }

  markSseConnected(tripId: string): void {
    const active = this.activeTripById.get(tripId);
    if (!active) {
      return;
    }
    active.sseConnections += 1;
    active.lastActivityAt = Date.now();
  }

  markSseDisconnected(tripId: string): void {
    const active = this.activeTripById.get(tripId);
    if (!active) {
      return;
    }
    active.sseConnections = Math.max(0, active.sseConnections - 1);
    active.lastActivityAt = Date.now();
  }

  getActiveTripStates(): Array<{
    tripId: string;
    lastActivityAt: number;
    sseConnections: number;
  }> {
    return [...this.activeTripById.values()].map((state) => ({
      tripId: state.tripId,
      lastActivityAt: state.lastActivityAt,
      sseConnections: state.sseConnections,
    }));
  }

  getTrackedRouteId(tripId: string): string | null {
    return this.activeTripById.get(tripId)?.currentRoute.id ?? null;
  }

  cleanupInactiveTrip(tripId: string): void {
    this.stopTrip(tripId);
  }

  onModuleDestroy(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.length = 0;
  }

  private registerActiveTrip(
    trip: TripEntity,
    route: MobilityRoute,
    targetArrivalTime: string,
    status: '여유' | '주의' | '긴급',
    bufferMinutes: number,
    currentPosition?: CurrentPositionInput,
  ): void {
    const position: CurrentPositionInput = currentPosition ?? {
      lat: route.mobilitySegments?.[0]?.startLat ?? 37.5665,
      lng: route.mobilitySegments?.[0]?.startLng ?? 126.978,
    };

    const movement = this.movementTracker.evaluate({
      currentPosition: position,
      segments: route.mobilitySegments ?? [],
    });

    const segment = route.mobilitySegments?.[movement.currentSegmentIndex];
    const nextAction = generateNextAction(segment, movement.progress, segment?.realtimeInfo, {
      departureInMinutes: bufferMinutes,
    });

    const delayMinutes = this.computeDelayMinutes(route);
    const now = Date.now();

    const previousTripId = this.tripIdByRouteId.get(route.id);
    if (previousTripId && previousTripId !== trip.id) {
      this.activeTripById.delete(previousTripId);
    }

    this.activeTripById.set(trip.id, {
      tripId: trip.id,
      currentRoute: route,
      targetArrivalTime,
      currentPosition: position,
      status,
      bufferMinutes,
      delayMinutes,
      nextAction,
      movement,
      rerouteCount: 0,
      lastActivityAt: now,
      lastPositionTimestamp: now,
      lastPositionReceivedAt: now,
      positionBurstWindow: [now],
      sseConnections: 0,
    });
    this.tripIdByRouteId.set(route.id, trip.id);

    this.metricsCollector.track(route, {
      offRoute: movement.isOffRoute,
    });
  }

  private async handleRouteEvent(
    tripId: string,
    routeId: string,
    reason:
      | 'eta_changed'
      | 'delay_increased'
      | 'risk_level_changed'
      | 'route_invalidated'
      | 'off_route',
  ): Promise<void> {
    const active = this.activeTripById.get(tripId);
    if (!active || active.currentRoute.id !== routeId) {
      return;
    }

    const refreshedRoute = this.realtimeUpdateScheduler.getTrackedRoute(routeId);
    if (!refreshedRoute) {
      return;
    }

    const previousStatus = active.status;
    const previousDelayMinutes = active.delayMinutes;

    active.currentRoute = refreshedRoute;
    active.delayMinutes = this.computeDelayMinutes(refreshedRoute);
    active.lastActivityAt = Date.now();

    const movement = this.movementTracker.evaluate({
      currentPosition: active.currentPosition,
      segments: refreshedRoute.mobilitySegments ?? [],
    });
    active.movement = movement;

    const segment = refreshedRoute.mobilitySegments?.[movement.currentSegmentIndex];
    active.nextAction = generateNextAction(segment, movement.progress, segment?.realtimeInfo, {
      departureInMinutes: active.bufferMinutes,
    });

    this.metricsCollector.track(refreshedRoute, {
      etaErrorMinutes: active.delayMinutes,
      offRoute: movement.isOffRoute,
    });

    const status = computeTimeFitStatus(refreshedRoute, active.targetArrivalTime);
    active.status = status.status;
    active.bufferMinutes = status.bufferMinutes;

    this.eventBus.emit('ROUTE_UPDATED', {
      tripId,
      routeId,
      reason,
    });

    if (previousStatus !== status.status) {
      this.eventBus.emit('STATUS_CHANGED', {
        tripId,
        routeId,
        previousStatus,
        nextStatus: status.status,
        bufferMinutes: status.bufferMinutes,
      });
    }

    this.timeFitNotifier.evaluate({
      route: refreshedRoute,
      previousStatus,
      nextStatus: status.status,
      previousDelayMinutes,
      nextDelayMinutes: active.delayMinutes,
    });

    if (
      reason === 'delay_increased' ||
      reason === 'risk_level_changed' ||
      reason === 'route_invalidated'
    ) {
      await this.evaluateReroute(tripId, active, reason, false);
    }
  }

  private async handleOffRoute(tripId: string, routeId: string): Promise<void> {
    const active = this.activeTripById.get(tripId);
    if (!active || active.currentRoute.id !== routeId) {
      return;
    }

    await this.evaluateReroute(tripId, active, 'off_route', true);
  }

  private async evaluateReroute(
    tripId: string,
    active: ActiveTripState,
    reason:
      | 'delay_increased'
      | 'risk_level_changed'
      | 'route_invalidated'
      | 'off_route',
    force: boolean,
  ): Promise<void> {
    const currentRoute = active.currentRoute;
    const realtimeState: RealtimeStateInput = {
      realtimeSegments: (currentRoute.mobilitySegments ?? []).map((segment, index) => ({
        index,
        realtimeStatus: segment.realtimeStatus,
        delayMinutes: segment.delayMinutes,
        etaMinutes: segment.realtimeInfo?.etaMinutes,
      })),
      delayMinutes: this.computeDelayMinutes(currentRoute),
      previousDelayRiskLevel: currentRoute.delayRiskLevel,
      currentDelayRiskLevel: currentRoute.delayRiskLevel,
      bufferMinutes: active.bufferMinutes,
      currentTime: new Date().toISOString(),
    };

    const result = await this.reRoutingEngine.evaluateReRoute(
      currentRoute,
      realtimeState,
      active.currentPosition,
      {
        force,
        forceReason: reason,
      },
    );

    this.eventBus.emit('REROUTE_TRIGGERED', {
      tripId,
      routeId: currentRoute.id,
      reason,
      keepCurrent: result.keepCurrent,
    });

    if (result.keepCurrent || !result.nextBestRoute) {
      return;
    }

    const previousRoute = active.currentRoute;
    this.realtimeUpdateScheduler.stopRouteTracking(previousRoute.id);
    this.tripIdByRouteId.delete(previousRoute.id);

    active.currentRoute = result.nextBestRoute;
    active.delayMinutes = this.computeDelayMinutes(result.nextBestRoute);
    active.rerouteCount += 1;
    active.lastActivityAt = Date.now();
    this.tripIdByRouteId.set(result.nextBestRoute.id, tripId);

    const status = computeTimeFitStatus(result.nextBestRoute, active.targetArrivalTime);
    active.status = status.status;
    active.bufferMinutes = status.bufferMinutes;

    this.realtimeUpdateScheduler.upsertTrackedRoute(result.nextBestRoute, tripId, active.targetArrivalTime);
    this.realtimeUpdateScheduler.startRouteTracking(result.nextBestRoute.id);

    this.metricsCollector.track(result.nextBestRoute, {
      rerouted: true,
      etaErrorMinutes: active.delayMinutes,
    });

    this.eventBus.emit('ROUTE_SWITCHED', {
      tripId,
      previousRouteId: previousRoute.id,
      nextRouteId: result.nextBestRoute.id,
      reason: result.reason,
    });

    this.logger.log(
      {
        event: 'trip.route.switched',
        tripId,
        previousRouteId: previousRoute.id,
        nextRouteId: result.nextBestRoute.id,
        reason: result.reason,
      },
      TripsService.name,
    );
  }

  private computeDelayMinutes(route: MobilityRoute): number {
    const realtime = route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes;
    return Math.max(0, realtime - route.estimatedTravelMinutes);
  }

  private buildRouteSummary(active: ActiveTripState): {
    realtimeAdjustedDurationMinutes: number;
    delayMinutes: number;
    delayRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;
    status: '여유' | '주의' | '긴급';
  } {
    return {
      realtimeAdjustedDurationMinutes:
        active.currentRoute.realtimeAdjustedDurationMinutes ?? active.currentRoute.estimatedTravelMinutes,
      delayMinutes: active.delayMinutes,
      delayRiskLevel: active.currentRoute.delayRiskLevel ?? 'LOW',
      score: Math.round(active.currentRoute.score ?? 0),
      status: active.status,
    };
  }

  private isValidPosition(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }

    if (lat < -90 || lat > 90) {
      return false;
    }

    if (lng < -180 || lng > 180) {
      return false;
    }

    return true;
  }
}
