import {
  BadRequestException,
  Body,
  UseGuards,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../common/http/api-response';
import { type AppEventEnvelope, EventBus } from '../../core/EventBus';
import { AuthAccessGuard, type AuthenticatedRequest } from '../auth/auth-access.guard';
import { RouteCandidatesDto } from './dto/route-candidates.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { StopTripDto } from './dto/stop-trip.dto';
import { TripPositionDto } from './dto/trip-position.dto';
import { TripPositionRateLimitGuard } from './guards/trip-position-rate-limit.guard';
import { TripLifecycleManager } from './services/TripLifecycleManager';
import { TripIdempotencyStore } from './services/trip-idempotency.store';
import { TripsService } from './services/trips.service';

@Controller()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly eventBus: EventBus,
    private readonly tripLifecycleManager: TripLifecycleManager,
    private readonly idempotencyStore: TripIdempotencyStore,
  ) {}

  @Post('routes')
  async routes(@Body() body: RouteCandidatesDto) {
    const result = await this.tripsService.getRouteCandidates(body.origin, body.destination);
    return ApiResponse.ok(result);
  }

  @Post('trips/start')
  @UseGuards(AuthAccessGuard)
  async start(
    @Req() request: AuthenticatedRequest,
    @Body() body: StartTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const authUserId = this.requireAuthUserId(request);
    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    if (!normalizedKey) {
      return ApiResponse.ok(this.tripsService.startTrip(body, authUserId));
    }

    const idempotencyInput = {
      userId: authUserId,
      scope: 'trip:start',
      key: normalizedKey,
      payload: body,
    };

    const existing = await this.idempotencyStore.begin<ReturnType<typeof ApiResponse.ok>>(idempotencyInput);
    if (existing.replayed && existing.response) {
      return existing.response;
    }

    try {
      const started = this.tripsService.startTrip(body, authUserId);
      const response = ApiResponse.ok(started);
      await this.idempotencyStore.complete(idempotencyInput, response);
      return response;
    } catch (error) {
      await this.idempotencyStore.clearPending(idempotencyInput);
      throw error;
    }
  }

  @Post('trips/:id/position')
  @UseGuards(AuthAccessGuard, TripPositionRateLimitGuard)
  updatePosition(
    @Req() request: AuthenticatedRequest,
    @Param('id') tripId: string,
    @Body() body: TripPositionDto,
  ) {
    return ApiResponse.ok(
      this.tripsService.updatePosition(tripId, body, this.requireAuthUserId(request)),
    );
  }

  @Post('trips/stop')
  @UseGuards(AuthAccessGuard)
  stop(@Req() request: AuthenticatedRequest, @Body() body: StopTripDto) {
    return ApiResponse.ok(this.tripsService.stopTrip(body.tripId, this.requireAuthUserId(request)));
  }

  @Get('trips/:id')
  @UseGuards(AuthAccessGuard)
  getTrip(@Req() request: AuthenticatedRequest, @Param('id') tripId: string) {
    return ApiResponse.ok(this.tripsService.getTrip(tripId, this.requireAuthUserId(request)));
  }

  @Sse('trips/:id/events')
  @UseGuards(AuthAccessGuard)
  events(
    @Req() request: AuthenticatedRequest,
    @Param('id') tripId: string,
    @Headers('last-event-id') lastEventId?: string,
    @Query('lastEventId') lastEventIdQuery?: string,
  ): Observable<MessageEvent> {
    this.tripsService.assertCanSubscribeToTrip(this.requireAuthUserId(request), tripId);

    return new Observable<MessageEvent>((subscriber) => {
      try {
        this.tripLifecycleManager.onSseConnected(tripId);

        const replay = this.tripsService.getReplayEvents(tripId, lastEventId ?? lastEventIdQuery);
        for (const envelope of replay) {
          const sse = this.toStandardSseEvent(tripId, envelope);
          if (sse) {
            subscriber.next(sse);
          }
        }

        subscriber.next(this.buildInitEvent(tripId));

        const pingTimer = setInterval(() => {
          subscriber.next({
            id: `ping-${Date.now()}`,
            type: 'PING',
            data: {
              eventId: `ping-${Date.now()}`,
              routeId: this.tripsService.getTrackedRouteId(tripId),
              timestamp: new Date().toISOString(),
              routeSummary: null,
              movement: null,
            },
          });
        }, 25_000);

        const unsubs = [
          this.eventBus.subscribeWithMeta('ETA_CHANGED', (envelope) => {
            this.publishIfTripMatched(subscriber, tripId, envelope);
          }),
          this.eventBus.subscribeWithMeta('STATUS_CHANGED', (envelope) => {
            this.publishIfTripMatched(subscriber, tripId, envelope);
          }),
          this.eventBus.subscribeWithMeta('ROUTE_SWITCHED', (envelope) => {
            this.publishIfTripMatched(subscriber, tripId, envelope);
          }),
          this.eventBus.subscribeWithMeta('POSITION_UPDATED', (envelope) => {
            this.publishIfTripMatched(subscriber, tripId, envelope);
          }),
          this.eventBus.subscribeWithMeta('OFF_ROUTE', (envelope) => {
            this.publishIfTripMatched(subscriber, tripId, envelope);
          }),
        ];

        return () => {
          clearInterval(pingTimer);
          unsubs.forEach((unsubscribe) => unsubscribe());
          this.tripLifecycleManager.onSseDisconnected(tripId);
        };
      } catch (error) {
        subscriber.next({
          id: `error-${Date.now()}`,
          type: 'ERROR',
          data: {
            eventId: `error-${Date.now()}`,
            routeId: this.tripsService.getTrackedRouteId(tripId),
            timestamp: new Date().toISOString(),
            routeSummary: null,
            movement: null,
            message: error instanceof Error ? error.message : 'unknown_error',
          },
        });
        subscriber.complete();
        return () => {};
      }
    });
  }

  private publishIfTripMatched(
    subscriber: { next: (event: MessageEvent) => void; complete: () => void },
    tripId: string,
    envelope: AppEventEnvelope,
  ): void {
    try {
      const payload = envelope.payload as { tripId?: string };
      if (payload.tripId !== tripId) {
        return;
      }

      const sse = this.toStandardSseEvent(tripId, envelope);
      if (sse) {
        subscriber.next(sse);
      }
    } catch (error) {
      subscriber.next({
        id: `error-${Date.now()}`,
        type: 'ERROR',
        data: {
          eventId: `error-${Date.now()}`,
          routeId: this.tripsService.getTrackedRouteId(tripId),
          timestamp: new Date().toISOString(),
          routeSummary: null,
          movement: null,
          message: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      subscriber.complete();
    }
  }

  private buildInitEvent(tripId: string): MessageEvent {
    const snapshot = this.tripsService.getTripSnapshot(tripId);
    return {
      id: `init-${Date.now()}`,
      type: 'INIT',
      data: {
        eventId: `init-${Date.now()}`,
        routeId: snapshot.route.id,
        timestamp: snapshot.timestamp,
        routeSummary: snapshot.routeSummary,
        movement: snapshot.movement,
        payload: {
          route: snapshot.route,
          status: snapshot.status,
          timestamp: snapshot.timestamp,
        },
      },
    };
  }

  private toStandardSseEvent(tripId: string, envelope: AppEventEnvelope): MessageEvent | null {
    const snapshot = this.tripsService.getTripSnapshot(tripId);
    const base = {
      eventId: envelope.eventId,
      routeId: snapshot.route.id,
      timestamp: envelope.timestamp,
      routeSummary: snapshot.routeSummary,
      movement: snapshot.movement,
    };

    if (envelope.eventName === 'ETA_CHANGED') {
      return {
        id: String(envelope.eventId),
        type: 'ETA_CHANGED',
        data: base,
      };
    }

    if (envelope.eventName === 'STATUS_CHANGED') {
      const payload = envelope.payload as { bufferMinutes: number; nextStatus: string };
      return {
        id: String(envelope.eventId),
        type: 'STATUS_CHANGED',
        data: {
          ...base,
          bufferMinutes: payload.bufferMinutes,
          status: payload.nextStatus,
        },
      };
    }

    if (envelope.eventName === 'ROUTE_SWITCHED') {
      const payload = envelope.payload as { previousRouteId: string };
      return {
        id: String(envelope.eventId),
        type: 'REROUTED',
        data: {
          ...base,
          oldRouteId: payload.previousRouteId,
          newRoute: snapshot.route,
        },
      };
    }

    if (envelope.eventName === 'POSITION_UPDATED') {
      return {
        id: String(envelope.eventId),
        type: 'POSITION_UPDATED',
        data: base,
      };
    }

    if (envelope.eventName === 'OFF_ROUTE') {
      return {
        id: String(envelope.eventId),
        type: 'OFF_ROUTE',
        data: base,
      };
    }

    return null;
  }

  private requireAuthUserId(request: AuthenticatedRequest): string {
    if (!request.authUserId) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return request.authUserId;
  }

  private validateIdempotencyKey(key: string | undefined): string | null {
    if (!key?.trim()) {
      return null;
    }

    const normalized = key.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(normalized)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be a valid UUID',
      });
    }

    return normalized;
  }
}
