import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { RoutinesController } from './routines.controller';
import { RoutineIdempotencyStore } from './services/routine-idempotency.store';
import { RoutinesRepository } from './services/routines.repository';
import { RoutinesService } from './services/routines.service';

@Module({
  imports: [AuthModule, RecommendationModule, NotificationsModule],
  controllers: [RoutinesController],
  providers: [RoutineIdempotencyStore, RoutinesRepository, RoutinesService, SafeLogger],
})
export class RoutinesModule {}
