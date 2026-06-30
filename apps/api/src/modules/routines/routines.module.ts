import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { PostgresIdempotencyStore } from '../../common/idempotency/postgres-idempotency.store';
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
  providers: [PostgresIdempotencyStore, RoutineIdempotencyStore, RoutinesRepository, RoutinesService, SafeLogger],
})
export class RoutinesModule {}
