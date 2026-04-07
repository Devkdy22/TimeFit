import { ConsoleLogger, Injectable } from '@nestjs/common';

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie', 'apikey', 'secret'];

@Injectable()
export class SafeLogger extends ConsoleLogger {
  override log(message: unknown, context?: string) {
    super.log(this.mask(message), context);
  }

  override error(message: unknown, trace?: string, context?: string) {
    super.error(this.mask(message), trace, context);
  }

  override warn(message: unknown, context?: string) {
    super.warn(this.mask(message), context);
  }

  override debug(message: unknown, context?: string) {
    super.debug(this.mask(message), context);
  }

  private mask(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const json = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

    for (const key of Object.keys(json)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        json[key] = '***';
      }
    }

    return json;
  }
}
