import { Module } from '@nestjs/common';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { AuthModule } from '../auth/auth.module';
import { SavedPlacesController } from './saved-places.controller';
import { SavedPlaceIdempotencyStore } from './services/saved-place-idempotency.store';
import { SavedPlacesMetrics } from './services/saved-places.metrics';
import { SavedPlacesRepository } from './services/saved-places.repository';
import { SavedPlacesService } from './services/saved-places.service';

@Module({
  imports: [AuthModule],
  controllers: [SavedPlacesController],
  providers: [SavedPlaceIdempotencyStore, SavedPlacesRepository, SavedPlacesService, SavedPlacesMetrics, SafeLogger],
})
export class SavedPlacesModule {}
