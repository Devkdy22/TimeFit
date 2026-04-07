import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/config/env.schema';
import { getRateLimitConfig } from './common/security/rate-limit.config';
import { HealthController } from './modules/health/health.controller';
import { OptionalRedisProvider } from './common/cache/redis.provider';
import { SafeLogger } from './common/logger/safe-logger.service';
import { AppConfigService } from './common/config/app-config.service';
import type { AppEnv } from './common/config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => [getRateLimitConfig(configService)],
    }),
  ],
  controllers: [HealthController],
  providers: [
    AppConfigService,
    OptionalRedisProvider,
    SafeLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
