import { Injectable } from '@nestjs/common';
import type { BusSegmentInput, EtaCacheValue } from '../realtime-bus.types';

@Injectable()
export class EtaCacheService {
  private readonly ttlMs = 30_000;
  private readonly staleMs = 90_000;
  private readonly cache = new Map<string, { value: EtaCacheValue; expiresAt: number; staleAt: number }>();

  getLive(segment: BusSegmentInput): EtaCacheValue | null {
    const entry = this.cache.get(this.keyOf(segment));
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.value;
  }

  getStale(segment: BusSegmentInput): EtaCacheValue | null {
    const entry = this.cache.get(this.keyOf(segment));
    if (!entry) {
      return null;
    }
    if (entry.staleAt <= Date.now()) {
      this.cache.delete(this.keyOf(segment));
      return null;
    }
    return entry.value;
  }

  set(segment: BusSegmentInput, value: EtaCacheValue): void {
    const now = Date.now();
    this.cache.set(this.keyOf(segment), {
      value,
      expiresAt: now + this.ttlMs,
      staleAt: now + this.staleMs,
    });
  }

  private keyOf(segment: BusSegmentInput): string {
    const route = segment.busRouteId ?? segment.lineLabel ?? '';
    const station = segment.startArsId ?? segment.startStationId ?? segment.startName ?? '';
    return `${route}:${station}`;
  }
}
