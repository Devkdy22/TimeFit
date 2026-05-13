import { Injectable } from '@nestjs/common';
import type { MobilitySegment } from '../../../recommendation/types/recommendation.types';

export interface MovementTrackingInput {
  currentPosition: {
    lat: number;
    lng: number;
  };
  segments: MobilitySegment[];
}

export interface MovementTrackingResult {
  currentSegmentIndex: number;
  progress: number;
  isOffRoute: boolean;
  nextAction: string;
  distanceFromRouteMeters: number;
  matchingConfidence: number;
}

@Injectable()
export class MovementTracker {
  evaluate(input: MovementTrackingInput): MovementTrackingResult {
    const { currentPosition, segments } = input;
    if (segments.length === 0) {
      return {
        currentSegmentIndex: 0,
        progress: 0,
        isOffRoute: false,
        nextAction: '도보 이동',
        distanceFromRouteMeters: 0,
        matchingConfidence: 0.4,
      };
    }

    const candidates = segments.map((segment, index) => {
      const start = this.resolveStart(segment);
      const end = this.resolveEnd(segment);
      if (!start || !end) {
        return {
          index,
          distanceFromRouteMeters: Number.POSITIVE_INFINITY,
          progress: 0,
        };
      }

      const projected = this.projectProgress(currentPosition, start, end);
      const closestPoint = {
        lat: start.lat + (end.lat - start.lat) * projected,
        lng: start.lng + (end.lng - start.lng) * projected,
      };
      const distanceFromRouteMeters = this.haversineMeters(currentPosition, closestPoint);

      return {
        index,
        distanceFromRouteMeters,
        progress: projected,
      };
    });

    const nearest = [...candidates].sort(
      (left, right) => left.distanceFromRouteMeters - right.distanceFromRouteMeters,
    )[0];

    const nearestSegment = segments[nearest?.index ?? 0];
    const hasFiniteDistance = !!nearest && Number.isFinite(nearest.distanceFromRouteMeters);
    const progress = nearest ? Number(nearest.progress.toFixed(2)) : 0;
    const distanceFromRouteMeters = hasFiniteDistance
      ? Number((nearest?.distanceFromRouteMeters ?? 0).toFixed(1))
      : 0;

    const isOffRoute = hasFiniteDistance ? distanceFromRouteMeters > 100 : false;
    const nextAction = this.resolveNextAction(nearestSegment);

    return {
      currentSegmentIndex: nearest?.index ?? 0,
      progress,
      isOffRoute,
      nextAction,
      distanceFromRouteMeters,
      matchingConfidence: this.toMatchingConfidence(distanceFromRouteMeters),
    };
  }

  private toMatchingConfidence(distanceFromRouteMeters: number): number {
    if (distanceFromRouteMeters <= 15) {
      return 0.95;
    }
    if (distanceFromRouteMeters <= 40) {
      return 0.8;
    }
    if (distanceFromRouteMeters <= 80) {
      return 0.55;
    }
    return 0.3;
  }

  private resolveNextAction(segment: MobilitySegment | undefined): string {
    if (!segment) {
      return '도보 이동';
    }

    if (segment.mode === 'walk') {
      return '도보 이동';
    }
    if (segment.mode === 'bus') {
      return '버스 탑승';
    }
    if (segment.mode === 'subway') {
      return '지하철 탑승';
    }
    return '도보 이동';
  }

  private resolveStart(segment: MobilitySegment): { lat: number; lng: number } | null {
    if (segment.startLat === undefined || segment.startLng === undefined) {
      return null;
    }

    return {
      lat: segment.startLat,
      lng: segment.startLng,
    };
  }

  private resolveEnd(segment: MobilitySegment): { lat: number; lng: number } | null {
    if (segment.endLat === undefined || segment.endLng === undefined) {
      return null;
    }

    return {
      lat: segment.endLat,
      lng: segment.endLng,
    };
  }

  private projectProgress(
    point: { lat: number; lng: number },
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
  ): number {
    const vx = end.lng - start.lng;
    const vy = end.lat - start.lat;
    const wx = point.lng - start.lng;
    const wy = point.lat - start.lat;

    const lenSquared = vx * vx + vy * vy;
    if (lenSquared === 0) {
      return 0;
    }

    const projected = (wx * vx + wy * vy) / lenSquared;
    return Math.min(1, Math.max(0, projected));
  }

  private haversineMeters(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const radius = 6_371_000;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

    return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
}
