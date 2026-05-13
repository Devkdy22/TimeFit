import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TripPositionRateLimitGuard implements CanActivate {
  private readonly lastSeenByKey = new Map<string, number>();
  private readonly minIntervalMs = 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      params?: { id?: string };
      body?: { timestamp?: number };
    }>();

    const tripId = request.params?.id ?? 'unknown-trip';
    const ip = request.ip ?? 'unknown-ip';
    const key = `${tripId}:${ip}`;
    const now = Date.now();

    const clientTimestamp = Number(request.body?.timestamp ?? NaN);
    const currentTs = Number.isFinite(clientTimestamp) ? clientTimestamp : now;

    const prev = this.lastSeenByKey.get(key);
    if (prev && currentTs - prev < this.minIntervalMs) {
      return false;
    }

    this.lastSeenByKey.set(key, currentTs);

    if (this.lastSeenByKey.size > 10_000) {
      const expiration = now - 10 * 60_000;
      for (const [seenKey, seenAt] of this.lastSeenByKey.entries()) {
        if (seenAt < expiration) {
          this.lastSeenByKey.delete(seenKey);
        }
      }
    }

    return true;
  }
}
