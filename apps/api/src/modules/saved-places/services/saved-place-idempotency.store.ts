import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';

type IdempotencyStatus = 'PENDING' | 'COMPLETED';

interface IdempotencyRecord<TResponse> {
  status: IdempotencyStatus;
  payloadHash: string;
  expiresAt: number;
  responseSnapshot?: TResponse;
}

export interface IdempotencyReplay<TResponse> {
  replayed: boolean;
  response?: TResponse;
}

const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SavedPlaceIdempotencyStore implements OnModuleDestroy {
  private readonly records = new Map<string, IdempotencyRecord<unknown>>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired(Date.now());
    }, 10 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  begin(scopeKey: string, payload: unknown): IdempotencyReplay<unknown> {
    const now = Date.now();
    this.cleanupExpired(now);
    const payloadHash = stableStringify(payload);
    const existing = this.records.get(scopeKey);

    if (!existing) {
      this.records.set(scopeKey, {
        status: 'PENDING',
        payloadHash,
        expiresAt: now + TTL_MS,
      });
      return { replayed: false };
    }

    if (existing.status === 'PENDING') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_PENDING',
        message: 'Request with this idempotency key is already in progress',
      });
    }

    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key was reused with different payload',
      });
    }

    return { replayed: true, response: existing.responseSnapshot };
  }

  complete(scopeKey: string, payload: unknown, responseSnapshot: unknown): void {
    const now = Date.now();
    const payloadHash = stableStringify(payload);
    this.records.set(scopeKey, {
      status: 'COMPLETED',
      payloadHash,
      responseSnapshot,
      expiresAt: now + TTL_MS,
    });
  }

  clearPending(scopeKey: string): void {
    const existing = this.records.get(scopeKey);
    if (existing?.status === 'PENDING') {
      this.records.delete(scopeKey);
    }
  }

  private cleanupExpired(now: number) {
    for (const [key, record] of this.records.entries()) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
      }
    }
  }
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${pairs.join(',')}}`;
}
