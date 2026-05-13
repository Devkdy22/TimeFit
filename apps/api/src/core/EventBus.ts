import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type AppEventName =
  | 'ROUTE_STARTED'
  | 'ROUTE_UPDATED'
  | 'ETA_CHANGED'
  | 'DELAY_INCREASED'
  | 'RISK_LEVEL_CHANGED'
  | 'STATUS_CHANGED'
  | 'REROUTE_TRIGGERED'
  | 'ROUTE_SWITCHED'
  | 'POSITION_UPDATED'
  | 'OFF_ROUTE'
  | 'METRIC';

export interface AppEventPayloadMap {
  ROUTE_STARTED: {
    tripId: string;
    routeId: string;
    targetArrivalTime: string;
  };
  ROUTE_UPDATED: {
    tripId: string;
    routeId: string;
    reason: string;
  };
  ETA_CHANGED: {
    tripId: string;
    routeId: string;
    previousEtaMinutes: number;
    nextEtaMinutes: number;
  };
  DELAY_INCREASED: {
    tripId: string;
    routeId: string;
    previousDelayMinutes: number;
    nextDelayMinutes: number;
  };
  RISK_LEVEL_CHANGED: {
    tripId: string;
    routeId: string;
    previousRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    nextRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  STATUS_CHANGED: {
    tripId: string;
    routeId: string;
    previousStatus: '여유' | '주의' | '긴급';
    nextStatus: '여유' | '주의' | '긴급';
    bufferMinutes: number;
  };
  REROUTE_TRIGGERED: {
    tripId: string;
    routeId: string;
    reason: string;
    keepCurrent: boolean;
  };
  ROUTE_SWITCHED: {
    tripId: string;
    previousRouteId: string;
    nextRouteId: string;
    reason: string;
  };
  POSITION_UPDATED: {
    tripId: string;
    routeId: string;
    timestamp: number;
    movement: {
      currentSegmentIndex: number;
      progress: number;
      isOffRoute: boolean;
      nextAction: string;
      distanceFromRouteMeters: number;
      matchingConfidence: number;
    };
  };
  OFF_ROUTE: {
    tripId: string;
    routeId: string;
    isOffRoute: boolean;
    consecutiveOffRouteCount: number;
    distanceFromRouteMeters: number;
  };
  METRIC: {
    routeId: string;
    delayRisk: number;
    score: number;
    rerouteCount: number;
    realtimeCoverage: number;
    offRouteRate: number;
    avgEtaErrorMinutes: number;
  };
}

export interface AppEventEnvelope<K extends AppEventName = AppEventName> {
  eventId: number;
  id: number;
  type: K;
  eventName: K;
  payload: AppEventPayloadMap[K];
  timestamp: string;
}

@Injectable()
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly history: AppEventEnvelope[] = [];
  private sequence = 0;
  private readonly historyLimit = 1000;

  emit<K extends AppEventName>(eventName: K, payload: AppEventPayloadMap[K]): void {
    const envelope: AppEventEnvelope<K> = {
      eventId: ++this.sequence,
      id: this.sequence,
      type: eventName,
      eventName,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.history.push(envelope);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    this.emitter.emit(eventName, payload);
    this.emitter.emit(`${eventName}:meta`, envelope);
  }

  cleanupTripEvents(tripId: string): void {
    this.history.splice(
      0,
      this.history.length,
      ...this.history.filter((envelope) => {
        const payload = envelope.payload as { tripId?: string };
        return payload.tripId !== tripId;
      }),
    );
  }

  cleanupHistory(maxEvents: number): void {
    if (this.history.length <= maxEvents) {
      return;
    }
    const deleteCount = this.history.length - maxEvents;
    this.history.splice(0, deleteCount);
  }

  emitLegacy<K extends AppEventName>(eventName: K, payload: AppEventPayloadMap[K]): void {
    const envelope: AppEventEnvelope<K> = {
      id: ++this.sequence,
      eventName,
      payload,
      timestamp: new Date().toISOString(),
      eventId: this.sequence,
      type: eventName,
    };
    this.history.push(envelope);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    this.emitter.emit(eventName, payload);
    this.emitter.emit(`${eventName}:meta`, envelope);
  }

  subscribe<K extends AppEventName>(
    eventName: K,
    handler: (payload: AppEventPayloadMap[K]) => void,
  ): () => void {
    const wrapped = (payload: AppEventPayloadMap[K]) => {
      handler(payload);
    };

    this.emitter.on(eventName, wrapped);

    return () => {
      this.emitter.off(eventName, wrapped);
    };
  }

  subscribeWithMeta<K extends AppEventName>(
    eventName: K,
    handler: (envelope: AppEventEnvelope<K>) => void,
  ): () => void {
    const key = `${eventName}:meta`;
    const wrapped = (envelope: AppEventEnvelope<K>) => {
      handler(envelope);
    };

    this.emitter.on(key, wrapped);
    return () => {
      this.emitter.off(key, wrapped);
    };
  }

  getEventsAfter(
    lastEventId: number,
    options?: {
      eventNames?: AppEventName[];
      filter?: (envelope: AppEventEnvelope) => boolean;
      limit?: number;
    },
  ): AppEventEnvelope[] {
    const eventNames = options?.eventNames;
    const filter = options?.filter;
    const limit = options?.limit ?? 200;

    const filtered = this.history.filter((envelope) => {
      if (envelope.id <= lastEventId) {
        return false;
      }
      if (eventNames && !eventNames.includes(envelope.eventName)) {
        return false;
      }
      if (filter && !filter(envelope)) {
        return false;
      }
      return true;
    });

    return filtered.slice(-limit);
  }
}
