import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { TripsController } from './trips.controller';
import { TripsRepository } from './services/trips.repository';
import { MetricsCollector } from './services/tracking/MetricsCollector';
import { MovementTracker } from './services/tracking/MovementTracker';
import { OffRouteHandler } from './services/tracking/OffRouteHandler';
import { PositionSmoother } from './services/tracking/PositionSmoother';
import { TripLifecycleManager } from './services/TripLifecycleManager';
import { TripsService } from './services/trips.service';
import { TripPositionRateLimitGuard } from './guards/trip-position-rate-limit.guard';

@Module({
  imports: [NotificationsModule, RecommendationModule],
  controllers: [TripsController],
  providers: [
    TripsRepository,
    TripsService,
    SafeLogger,
    MovementTracker,
    PositionSmoother,
    OffRouteHandler,
    MetricsCollector,
    TripLifecycleManager,
    TripPositionRateLimitGuard,
  ],
})
export class TripsModule {}
