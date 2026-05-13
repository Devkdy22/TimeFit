import { Injectable } from '@nestjs/common';
import type { BusSegmentInput, MappingCacheValue } from '../realtime-bus.types';

@Injectable()
export class MappingCacheService {
  private readonly ttlMs = 24 * 60 * 60 * 1000;
  private readonly cache = new Map<string, { value: MappingCacheValue; expiresAt: number }>();

  get(segment: BusSegmentInput): MappingCacheValue | null {
    const key = this.keyOf(segment);
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(segment: BusSegmentInput, value: MappingCacheValue): void {
    this.cache.set(this.keyOf(segment), { value, expiresAt: Date.now() + this.ttlMs });
  }

  private keyOf(segment: BusSegmentInput): string {
    const lat = typeof segment.startLat === 'number' ? segment.startLat.toFixed(4) : '0';
    const lng = typeof segment.startLng === 'number' ? segment.startLng.toFixed(4) : '0';
    return `${segment.lineLabel ?? ''}:${segment.startArsId ?? ''}:${lat},${lng}`;
  }
}
