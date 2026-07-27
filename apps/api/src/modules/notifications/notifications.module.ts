import { Module } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { ExpoNotificationClient } from './integrations/expo-notification.client';
import { NotificationService } from './services/notification.service';
import { NotificationsController } from './notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [AppConfigService, SafeLogger, ExpoNotificationClient, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
