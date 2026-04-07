import type { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env.schema';

export function getRateLimitConfig(configService: ConfigService<AppEnv, true>) {
  return {
    ttl: configService.get('RATE_LIMIT_TTL_MS', { infer: true }),
    limit: configService.get('RATE_LIMIT_MAX', { infer: true }),
  };
}
