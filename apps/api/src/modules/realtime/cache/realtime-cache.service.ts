import { Injectable } from '@nestjs/common';
import type { RealtimeEtaResponse } from '../realtime.types';

interface RealtimeCacheEntry {
  freshUntil: number;
  staleUntil: number;
  failureCount: number;
  value: RealtimeEtaResponse;
}

@Injectable()
export class RealtimeCacheService {
  private readonly entries = new Map<string, RealtimeCacheEntry>();
  private readonly inFlight = new Map<string, Promise<RealtimeEtaResponse>>();

  getFresh(key: string): RealtimeEtaResponse | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.freshUntil < Date.now()) {
      return null;
    }
    return entry.value;
  }

  getStale(key: string): RealtimeEtaResponse | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.staleUntil < Date.now()) {
      return null;
    }
    return entry.value;
  }

  getFailureCount(key: string): number {
    return this.entries.get(key)?.failureCount ?? 0;
  }

  setSuccess(
    key: string,
    value: RealtimeEtaResponse,
    options?: { freshTtlMs?: number; staleTtlMs?: number },
  ): void {
    const freshTtlMs = options?.freshTtlMs ?? 30_000;
    const staleTtlMs = options?.staleTtlMs ?? 90_000;
    this.entries.set(key, {
      value,
      failureCount: 0,
      freshUntil: Date.now() + freshTtlMs,
      staleUntil: Date.now() + staleTtlMs,
    });
  }

  markFailure(key: string): number {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (!existing) {
      const placeholder: RealtimeEtaResponse = {
        type: 'BUS',
        status: 'CHECKING',
        etaMinutes: null,
        source: 'CACHE',
        reasonCode: null,
        updatedAt: new Date(now).toISOString(),
      };
      this.entries.set(key, {
        value: placeholder,
        failureCount: 1,
        freshUntil: now,
        staleUntil: now,
      });
      return 1;
    }

    const next = existing.failureCount + 1;
    this.entries.set(key, {
      ...existing,
      failureCount: next,
    });
    return next;
  }

  withInFlight(key: string, task: () => Promise<RealtimeEtaResponse>): Promise<RealtimeEtaResponse> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = task().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}

