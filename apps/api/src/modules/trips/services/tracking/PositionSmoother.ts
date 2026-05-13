import { Injectable } from '@nestjs/common';

export interface GeoPosition {
  lat: number;
  lng: number;
}

@Injectable()
export class PositionSmoother {
  private readonly alpha = 0.35;
  private readonly previousByTripId = new Map<string, GeoPosition>();

  smooth(tripId: string, next: GeoPosition): GeoPosition {
    const prev = this.previousByTripId.get(tripId);
    if (!prev) {
      this.previousByTripId.set(tripId, next);
      return next;
    }

    const smoothed: GeoPosition = {
      lat: Number((this.alpha * next.lat + (1 - this.alpha) * prev.lat).toFixed(7)),
      lng: Number((this.alpha * next.lng + (1 - this.alpha) * prev.lng).toFixed(7)),
    };

    this.previousByTripId.set(tripId, smoothed);
    return smoothed;
  }

  reset(tripId: string): void {
    this.previousByTripId.delete(tripId);
  }
}
