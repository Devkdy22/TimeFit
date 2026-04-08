import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { TripEntity } from '../types/trip.types';

interface CreateTripInput {
  userId: string;
  recommendationId: string;
  startedAt: string;
  currentRoute: string;
  departureAt?: string;
  arrivalAt?: string;
  expoPushToken?: string;
  plannedDurationMinutes: number;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  stationName?: string;
}

@Injectable()
export class TripsRepository {
  private readonly store = new Map<string, TripEntity>();

  create(input: CreateTripInput): TripEntity {
    const startedAt = new Date(input.startedAt);
    const departureAt = input.departureAt
      ? new Date(input.departureAt)
      : new Date(startedAt.getTime());
    const arrivalAt = input.arrivalAt
      ? new Date(input.arrivalAt)
      : new Date(startedAt.getTime() + input.plannedDurationMinutes * 60_000);

    const entity: TripEntity = {
      id: randomUUID(),
      userId: input.userId,
      recommendationId: input.recommendationId,
      status: 'preparing',
      startedAt: startedAt.toISOString(),
      currentRoute: input.currentRoute,
      departureAt: departureAt.toISOString(),
      arrivalAt: arrivalAt.toISOString(),
      expoPushToken: input.expoPushToken,
      plannedDurationMinutes: input.plannedDurationMinutes,
      expectedArrivalAt: arrivalAt.toISOString(),
      delayOffsetMinutes: this.generateDelayOffset(input.recommendationId),
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      stationName: input.stationName,
    };

    this.store.set(entity.id, entity);
    return entity;
  }

  findById(id: string): TripEntity {
    const trip = this.store.get(id);
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }

  updateStatus(id: string, status: TripEntity['status']): TripEntity {
    const trip = this.findById(id);
    const next = { ...trip, status };
    this.store.set(id, next);
    return next;
  }

  private generateDelayOffset(seed: string): number {
    const hash = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 8;
  }
}
