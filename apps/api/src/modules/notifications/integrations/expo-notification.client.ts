import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
}

@Injectable()
export class ExpoNotificationClient {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async send(message: ExpoPushMessage): Promise<void> {
    if (!message.to || !message.to.startsWith('ExponentPushToken[')) {
      this.logger.warn(
        {
          event: 'notification.expo.skip',
          reason: 'invalid_expo_push_token',
        },
        ExpoNotificationClient.name,
      );
      return;
    }

    try {
      const response = await fetch(this.appConfigService.expoPushApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ...message,
          sound: 'default',
        }),
      });

      if (!response.ok) {
        throw new Error(`expo_push_failed:${response.status}`);
      }

      this.logger.log(
        {
          event: 'notification.expo.sent',
          title: message.title,
        },
        ExpoNotificationClient.name,
      );
    } catch (error) {
      this.logger.warn(
        {
          event: 'notification.expo.error',
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        ExpoNotificationClient.name,
      );
    }
  }
}
