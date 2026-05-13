import {
  Body,
  UseGuards,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../common/http/api-response';
import { type AppEventEnvelope, EventBus } from '../../core/EventBus';
import { RouteCandidatesDto } from './dto/route-candidates.dto';
import { StartTripDto } from './dto/start-trip.dto';
import { StopTripDto } from './dto/stop-trip.dto';
import { TripPositionDto } from './dto/trip-position.dto';
import { TripPositionRateLimitGuard } from './guards/trip-position-rate-limit.guard';
import { TripLifecycleManager } from './services/TripLifecycleManager';
import { TripsService } from './services/trips.service';

@Controller()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly eventBus: EventBus,
    private readonly tripLifecycleManager: TripLifecycleManager,
  ) {}

  @Post('routes')
  async routes(@Body() body: RouteCandidatesDto) {
    const result = await this.tripsService.getRouteCandidates(body.origin, body.destination);
    return ApiResponse.ok(result);
  }

  @Post('trips/start')
  start(@Body() body: StartTripDto) {
    return ApiResponse.ok(this.tripsService.startTrip(body));
  }

  @Post('trips/:id/position')
  @UseGuards(TripPositionRateLimitGuard)
  updatePosition(@Param('id') tripId: string, @Body() body: TripPositionDto) {
    return ApiResponse.ok(this.tripsService.updatePosition(tripId, body));
  }

  @Post('trips/stop')
  stop(@Body() body: StopTripDto) {
    return ApiResponse.ok(this.tripsService.stopTrip(body.tripId));
  }

  @Get('trips/:id')
  getTrip(@Param('id') tripId: string) {
    return ApiResponse.ok(this.tripsService.getTrip(tripId));
  }

  @Sse('trips/:id/events')
  events(
    @Param('id') tripId: string,
    @Headers('last-event-id') lastEventId?: string,
    @Query('lastEventId') lastEventIdQuery?: string,
  ): Observable<MessageEvent> {
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
}
