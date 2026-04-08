import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SeoulBusClient } from '../recommendation/integrations/seoul-bus.client';
import { SeoulSubwayClient } from '../recommendation/integrations/seoul-subway.client';
import { TrafficClient } from '../recommendation/integrations/traffic.client';
import { WeatherClient } from '../recommendation/integrations/weather.client';
import { TripsController } from './trips.controller';
import { TripsRepository } from './services/trips.repository';
import { TripsService } from './services/trips.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TripsController],
  providers: [
    TripsRepository,
    TripsService,
    AppConfigService,
    SafeLogger,
    SeoulBusClient,
    SeoulSubwayClient,
    TrafficClient,
    WeatherClient,
  ],
})
export class TripsModule {}
