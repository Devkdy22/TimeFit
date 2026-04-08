import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { RoutinesController } from './routines.controller';
import { RoutinesRepository } from './services/routines.repository';
import { RoutinesService } from './services/routines.service';

@Module({
  imports: [RecommendationModule, NotificationsModule],
  controllers: [RoutinesController],
  providers: [RoutinesRepository, RoutinesService, SafeLogger],
})
export class RoutinesModule {}
