import { ConsoleLogger, Injectable } from '@nestjs/common';
import { getRequestLogContext } from './request-context';

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie', 'apikey', 'secret'];

function maskString(value: string): string {
  return value
    .replace(/(Bearer\s+)[^\s,}]+/gi, '$1***')
    .replace(/(KakaoAK\s+)[^\s,}]+/gi, '$1***')
    .replace(/([?&](?:api[_-]?key|token|access[_-]?token|refresh[_-]?token|authorization|client[_-]?secret)=)[^&#\s]+/gi, '$1***');
}

@Injectable()
export class SafeLogger extends ConsoleLogger {
  override log(message: unknown, context?: string) {
    super.log(this.enrich(this.mask(message)), context);
  }

  override error(message: unknown, trace?: string, context?: string) {
    super.error(this.enrich(this.mask(message)), trace ? maskString(trace) : trace, context);
  }

  override warn(message: unknown, context?: string) {
    super.warn(this.enrich(this.mask(message)), context);
  }

  override debug(message: unknown, context?: string) {
    super.debug(this.enrich(this.mask(message)), context);
  }

  private mask(payload: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof payload === 'string') {
      return maskString(payload);
    }

    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    if (seen.has(payload)) {
      return '[Circular]';
    }
    seen.add(payload);

    if (payload instanceof Error) {
      return {
        name: payload.name,
        message: maskString(payload.message),
      };
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.mask(item, seen));
    }

    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        masked[key] = '***';
      } else {
        masked[key] = this.mask(value, seen);
      }
    }

    return masked;
  }

  private enrich(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const context = getRequestLogContext();
    if (!context) {
      return payload;
    }

    return {
      requestId: context.requestId,
      tripId: context.tripId,
      routeId: context.routeId,
      ...(payload as Record<string, unknown>),
    };
  }
}
