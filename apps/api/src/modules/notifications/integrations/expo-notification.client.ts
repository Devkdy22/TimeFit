import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
}

export type ExpoNotificationSendResult = 'sent' | 'skipped' | 'failed' | 'invalid';
export type ExpoNotificationSendOutcome = {
  result: ExpoNotificationSendResult;
  ticketId?: string;
};

export type ExpoNotificationReceipt = {
  status: 'ok' | 'error';
  details?: { error?: string };
  message?: string;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ExpoNotificationClient {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async send(message: ExpoPushMessage): Promise<ExpoNotificationSendResult> {
    return (await this.sendWithTicket(message)).result;
  }

  async sendWithTicket(message: ExpoPushMessage): Promise<ExpoNotificationSendOutcome> {
    if (!message.to || !message.to.startsWith('ExponentPushToken[')) {
      this.logger.warn(
        {
          event: 'notification.expo.skip',
          reason: 'invalid_expo_push_token',
        },
        ExpoNotificationClient.name,
      );
      return { result: 'skipped' };
    }

    try {
      const body = JSON.stringify({
        ...message,
        sound: message.sound === undefined ? 'default' : message.sound,
        channelId: message.channelId ?? 'timefit',
      });
      let response: Response | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await this.fetchWithTimeout(this.appConfigService.expoPushApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body,
        });

        if (response.ok) break;

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 1) {
          throw new Error(`expo_push_failed:${response.status}`);
        }

        const retryAfterSeconds = Number(response.headers?.get('retry-after') ?? '');
        const retryDelayMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(1000, Math.max(0, retryAfterSeconds * 1000))
          : 100;
        await wait(retryDelayMs);
      }

      if (!response?.ok) {
        throw new Error('expo_push_failed:no_response');
      }

      const payload = (await response.json().catch(() => null)) as {
        data?: Array<{ status?: string; id?: string; details?: { error?: string } }>;
      } | null;
      const tickets = payload?.data;
      if (!Array.isArray(tickets) || tickets.length === 0) {
        throw new Error('expo_push_failed:invalid_payload');
      }
      if (tickets.some((ticket) => ticket.status !== 'ok' && ticket.status !== 'error')) {
        throw new Error('expo_push_failed:invalid_ticket_status');
      }
      const ticketError = tickets.find((ticket) => ticket.status === 'error');
      if (ticketError) {
        const reason = ticketError.details?.error ?? 'unknown_ticket_error';
        this.logger.warn(
          { event: 'notification.expo.ticket_error', reason },
          ExpoNotificationClient.name,
        );
        return { result: reason === 'DeviceNotRegistered' || reason === 'InvalidCredentials' ? 'invalid' : 'failed' };
      }

      this.logger.log(
        {
          event: 'notification.expo.sent',
          title: message.title,
        },
        ExpoNotificationClient.name,
      );
      return { result: 'sent', ticketId: tickets.find((ticket) => ticket.status === 'ok')?.id };
    } catch (error) {
      this.logger.warn(
        {
          event: 'notification.expo.error',
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        ExpoNotificationClient.name,
      );
      return { result: 'failed' };
    }
  }

  async getReceipts(ticketIds: string[]): Promise<Record<string, ExpoNotificationReceipt>> {
    if (ticketIds.length === 0) return {};
    const receiptUrl = this.appConfigService.expoPushApiUrl.replace(/\/send\/?$/, '/getReceipts');
    const response = await this.fetchWithTimeout(receiptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds.slice(0, 1000) }),
    });
    if (!response.ok) {
      throw new Error(`expo_receipts_failed:${response.status}`);
    }
    const payload = (await response.json().catch(() => null)) as {
      data?: Record<string, ExpoNotificationReceipt>;
    } | null;
    return payload?.data ?? {};
  }

  private async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = this.appConfigService.expoPushTimeoutMs ?? 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
