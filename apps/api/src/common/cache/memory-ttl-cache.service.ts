import { Injectable } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class MemoryTtlCacheService {
  private readonly store = new Map<string, CacheItem<unknown>>();

  get<T>(key: string): T | null {
    const found = this.store.get(key);
    if (!found) {
      return null;
    }

    if (Date.now() > found.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return found.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) {
      return cached;
    }

    const loaded = await loader();
    this.set(key, loaded, ttlMs);
    return loaded;
  }
}
