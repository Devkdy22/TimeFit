import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppEnv, true>) {}

  get nodeEnv() {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  get port() {
    return this.configService.get('PORT', { infer: true });
  }

  get databaseUrl() {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get jwtAccessSecret() {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret() {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get kakaoApiKey() {
    return this.configService.get('KAKAO_API_KEY', { infer: true });
  }

  get trafficApiKey() {
    return this.configService.get('TRAFFIC_API_KEY', { infer: true });
  }

  get weatherApiKey() {
    return this.configService.get('WEATHER_API_KEY', { infer: true });
  }

  get seoulApiKey() {
    return this.configService.get('SEOUL_API_KEY', { infer: true });
  }

  get seoulSubwayApiKey() {
    return this.configService.get('SEOUL_SUBWAY_API_KEY', { infer: true });
  }

  get trafficApiUrl() {
    return this.configService.get('TRAFFIC_API_URL', { infer: true });
  }

  get weatherApiUrl() {
    return this.configService.get('WEATHER_API_URL', { infer: true });
  }

  get seoulBusApiUrl() {
    return this.configService.get('SEOUL_BUS_API_URL', { infer: true });
  }

  get seoulSubwayApiUrl() {
    return this.configService.get('SEOUL_SUBWAY_API_URL', { infer: true });
  }

  get fcmServerKey() {
    return this.configService.get('FCM_SERVER_KEY', { infer: true });
  }

  get expoPushApiUrl() {
    return this.configService.get('EXPO_PUSH_API_URL', { infer: true });
  }

  get corsOrigins() {
    const raw = this.configService.get('CORS_ORIGINS', { infer: true }) ?? '';
    return raw
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);
  }

  get rateLimitTtlMs() {
    return this.configService.get('RATE_LIMIT_TTL_MS', { infer: true });
  }

  get rateLimitMax() {
    return this.configService.get('RATE_LIMIT_MAX', { infer: true });
  }

  get redisUrl() {
    return this.configService.get('REDIS_URL', { infer: true });
  }
}
