import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { RecommendationResult } from '../../recommendation/types/recommendation.types';
import type { TripEntity, TripLiveStatus } from '../../trips/types/trip.types';
import {
  ExpoNotificationClient,
  type ExpoNotificationReceipt,
  type ExpoNotificationSendOutcome,
  type ExpoNotificationSendResult,
} from '../integrations/expo-notification.client';
import type { RegisterPushTokenDto } from '../dto/register-push-token.dto';
import type { UpdateNotificationPreferencesDto } from '../dto/update-notification-preferences.dto';

interface LiveNotificationInput {
  trip: TripEntity;
  currentStatus: TripLiveStatus;
  remainingMinutes: number;
  estimatedArrivalAt: string;
  delayMinutes: number;
  rerouteOccurred?: boolean;
  rerouteCount?: number;
  nextRouteId?: string;
  rerouteReason?: string;
}

interface NotificationState {
  departureSentAt?: string;
  lastDelayMinutes?: number;
  lastStatus?: TripLiveStatus;
  rerouteSentAt?: string;
  lastRerouteCount?: number;
}

interface RoutineNotificationInput {
  userId: string;
  pushToken: string;
  routineId: string;
  title: string;
  body: string;
  recommendation: RecommendationResult;
}

type NotificationClaimDisposition = 'claimed' | 'already_sent' | 'in_flight';
type NotificationClaim = { id: string; disposition: NotificationClaimDisposition };
type RoutineNotificationResult = ExpoNotificationSendResult | 'already_sent' | 'in_flight';

type NotificationDbClient = {
  device: {
    findFirst(args: {
      where: { userId: string; platform?: string };
      orderBy?: { updatedAt: 'asc' | 'desc' };
    }): Promise<{ id: string; pushToken?: string | null } | null>;
    create(args: { data: { userId: string; platform: string; pushToken: string } }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: { pushToken: string } }): Promise<{ id: string }>;
    updateMany(args: { where: { userId: string; pushToken: string }; data: { pushToken: null } }): Promise<{ count: number }>;
  };
  routine: {
    updateMany(args: { where: { userId: string; expoPushToken?: string }; data: { expoPushToken: string | null } }): Promise<{ count: number }>;
  };
  trip: {
    updateMany(args: { where: { userId: string; expoPushToken?: string }; data: { expoPushToken: string | null } }): Promise<{ count: number }>;
  };
  preference: {
    findFirst(args: { where: { userId: string } }): Promise<NotificationPreferenceRow | null>;
    create(args: { data: NotificationPreferenceData & { userId: string } }): Promise<NotificationPreferenceRow>;
    update(args: { where: { id: string }; data: NotificationPreferenceData }): Promise<NotificationPreferenceRow>;
  };
  notification: {
    findUnique(args: { where: { dedupKey: string } }): Promise<{ id: string; status: string; createdAt: Date } | null>;
    create(args: { data: { userId: string; tripId?: string; dedupKey: string; eventType: string; channel: string; status: string; scheduledAt: Date } }): Promise<{ id: string }>;
    update(args: { where: { id: string }; data: { status: string; sentAt?: Date | null; providerTicketId?: string | null; providerPushToken?: string | null; receiptCheckedAt?: Date | null } }): Promise<{ id: string }>;
    findMany(args: { where: { status: string; providerTicketId: { not: null }; receiptCheckedAt: null; sentAt: { lt: Date } }; take: number }): Promise<Array<{ id: string; userId: string; providerTicketId: string; providerPushToken?: string | null }>>;
    updateMany(args: {
      where: { id: string; status: string; scheduledAt?: { lt: Date } };
      data: { status: string; sentAt: null; scheduledAt: Date };
    }): Promise<{ count: number }>;
  };
};

type NotificationPreferenceData = {
  notificationEnabled: boolean;
  departureLeadMinutes: number;
  delayNotificationEnabled: boolean;
  rerouteNotificationEnabled: boolean;
  vibrationEnabled: boolean;
};

type NotificationPreferenceRow = NotificationPreferenceData & { id: string; userId: string };

@Injectable()
export class NotificationService {
  private readonly stateByTrip = new Map<string, NotificationState>();
  private readonly preferenceCache = new Map<string, { value: NotificationPreferenceData; expiresAt: number }>();
  private prisma: NotificationDbClient | null = null;

  constructor(
    private readonly expoNotificationClient: ExpoNotificationClient,
    private readonly logger: SafeLogger,
    private readonly appConfig: AppConfigService,
  ) {}

  async registerPushToken(userId: string, input: RegisterPushTokenDto): Promise<{ registered: true }> {
    const prisma = await this.getPrismaClient();
    const device = await prisma.device.findFirst({
      where: { userId, platform: input.platform },
      orderBy: { updatedAt: 'desc' },
    });
    if (device) {
      await prisma.device.update({ where: { id: device.id }, data: { pushToken: input.token } });
    } else {
      await prisma.device.create({ data: { userId, platform: input.platform, pushToken: input.token } });
    }
    // Keep existing routine records compatible with the current routine worker,
    // which reads the token stored on each routine.
    await prisma.routine.updateMany({ where: { userId }, data: { expoPushToken: input.token } });
    await prisma.trip.updateMany({ where: { userId }, data: { expoPushToken: input.token } });
    this.logger.log({ event: 'notification.push_token.registered', userId, platform: input.platform }, NotificationService.name);
    return { registered: true };
  }

  async getRegisteredPushToken(userId: string): Promise<string | undefined> {
    const device = await (await this.getPrismaClient()).device.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return device?.pushToken ?? undefined;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferenceData> {
    const cached = this.preferenceCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const row = await (await this.getPrismaClient()).preference.findFirst({ where: { userId } });
    const value = this.toNotificationPreferences(row);
    this.preferenceCache.set(userId, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }

  async updateNotificationPreferences(userId: string, input: UpdateNotificationPreferencesDto): Promise<NotificationPreferenceData> {
    const prisma = await this.getPrismaClient();
    const existing = await prisma.preference.findFirst({ where: { userId } });
    const next = {
      ...this.toNotificationPreferences(existing),
      ...input,
    };
    const row = existing
      ? await prisma.preference.update({ where: { id: existing.id }, data: next })
      : await prisma.preference.create({ data: { userId, ...next } });
    const value = this.toNotificationPreferences(row);
    this.preferenceCache.set(userId, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }

  async handleTripLiveNotification(input: LiveNotificationInput): Promise<void> {
    const pushToken = input.trip.expoPushToken;
    if (!pushToken) {
      return;
    }

    const state = this.stateByTrip.get(input.trip.id) ?? {};
    const preferences = await this.getNotificationPreferences(input.trip.userId);
    if (!preferences.notificationEnabled) return;

    await this.maybeSendDepartureNotification(input, state, pushToken, preferences.departureLeadMinutes, preferences.vibrationEnabled);
    const delayNotificationHandled = preferences.delayNotificationEnabled
      ? await this.maybeSendDelayNotification(input, state, pushToken, preferences.vibrationEnabled)
      : true;
    if (preferences.rerouteNotificationEnabled) await this.maybeSendRerouteNotification(input, state, pushToken, preferences.vibrationEnabled);

    // Keep the previous baseline when delivery failed so the next live update
    // can retry the same delay notification instead of treating it as handled.
    if (delayNotificationHandled) {
      state.lastDelayMinutes = input.delayMinutes;
    }
    state.lastStatus = input.currentStatus;
    this.stateByTrip.set(input.trip.id, state);
  }

  async sendRoutineNotification(input: RoutineNotificationInput): Promise<RoutineNotificationResult> {
    const preferences = await this.getNotificationPreferences(input.userId);
    if (!preferences.notificationEnabled) return 'skipped';
    const claim = await this.claimNotification(input.userId, undefined, `routine:${input.routineId}:${this.toDateKey(new Date())}`, 'routine_recommendation');
    if (!claim || claim.disposition === 'in_flight') return 'in_flight';
    if (claim.disposition === 'already_sent') return 'already_sent';
    const delivery = await this.sendPush({
      to: input.pushToken,
      title: input.title,
      body: input.body,
      sound: preferences.vibrationEnabled ? 'default' : null,
      channelId: preferences.vibrationEnabled ? 'timefit' : 'timefit-silent',
      data: {
        type: 'routine_recommendation',
        routineId: input.routineId,
        primaryRouteId: input.recommendation.primaryRoute.route.id,
        status: input.recommendation.status,
        nextAction: input.recommendation.nextAction,
      },
    });

    const result = delivery.result;
    await this.finalizeNotification(claim.id, result === 'sent', delivery, input.pushToken);
    if (result !== 'sent') {
      if (this.shouldClearPushToken(result)) await this.clearInvalidToken(input.userId, input.pushToken);
      return result;
    }
    this.logger.log(
      {
        event: 'routine.notification.sent',
        routineId: input.routineId,
        primaryRouteId: input.recommendation.primaryRoute.route.id,
      },
      NotificationService.name,
    );
    return 'sent';
  }

  private async maybeSendDepartureNotification(
    input: LiveNotificationInput,
    state: NotificationState,
    pushToken: string,
    leadMinutes: number,
    vibrationEnabled: boolean,
  ): Promise<void> {
    if (state.departureSentAt) {
      return;
    }

    const departureAt = new Date(input.trip.departureAt).getTime();
    const now = Date.now();
    const minutesToDeparture = Math.floor((departureAt - now) / 60_000);

    if (minutesToDeparture > leadMinutes || minutesToDeparture < -3) {
      return;
    }

    const claim = await this.claimNotification(input.trip.userId, input.trip.id, `trip:${input.trip.id}:departure`, 'departure');
    if (!claim || claim.disposition !== 'claimed') return;
    const delivery = await this.sendPush({
      to: pushToken,
      title: '출발 알림',
      body: minutesToDeparture <= 0 ? '지금 출발할 시간입니다.' : `${minutesToDeparture}분 후 출발하세요.`,
      sound: vibrationEnabled ? 'default' : null,
      channelId: vibrationEnabled ? 'timefit' : 'timefit-silent',
      data: {
        type: 'departure',
        tripId: input.trip.id,
        departureAt: input.trip.departureAt,
      },
    });

    const result = delivery.result;
    await this.finalizeNotification(claim.id, result === 'sent', delivery, pushToken);
    if (result !== 'sent') {
      if (this.shouldClearPushToken(result)) await this.clearInvalidToken(input.trip.userId, pushToken);
      return;
    }
    state.departureSentAt = new Date().toISOString();

    this.logger.log(
      {
        event: 'trip.notification.departure',
        tripId: input.trip.id,
        minutesToDeparture,
      },
      NotificationService.name,
    );
  }

  private async maybeSendDelayNotification(
    input: LiveNotificationInput,
    state: NotificationState,
    pushToken: string,
    vibrationEnabled: boolean,
  ): Promise<boolean> {
    const previousDelay = state.lastDelayMinutes ?? 0;
    const delayIncrease = input.delayMinutes - previousDelay;

    if (delayIncrease < 2) {
      return true;
    }

    const claim = await this.claimNotification(input.trip.userId, input.trip.id, `trip:${input.trip.id}:delay:${input.delayMinutes}`, 'delay');
    if (!claim) return false;
    if (claim.disposition === 'already_sent') return true;
    if (claim.disposition !== 'claimed') return false;
    const delivery = await this.sendPush({
      to: pushToken,
      title: '지연 증가 알림',
      body: `지연이 ${delayIncrease}분 증가했습니다. ETA를 확인하세요.`,
      sound: vibrationEnabled ? 'default' : null,
      channelId: vibrationEnabled ? 'timefit' : 'timefit-silent',
      data: {
        type: 'delay',
        tripId: input.trip.id,
        delayMinutes: input.delayMinutes,
        estimatedArrivalAt: input.estimatedArrivalAt,
      },
    });

    const result = delivery.result;
    await this.finalizeNotification(claim.id, result === 'sent', delivery, pushToken);
    if (result !== 'sent') {
      if (this.shouldClearPushToken(result)) await this.clearInvalidToken(input.trip.userId, pushToken);
      return false;
    }
    this.logger.log(
      {
        event: 'trip.notification.delay',
        tripId: input.trip.id,
        previousDelay,
        currentDelay: input.delayMinutes,
      },
      NotificationService.name,
    );
    return true;
  }

  private async maybeSendRerouteNotification(
    input: LiveNotificationInput,
    state: NotificationState,
    pushToken: string,
    vibrationEnabled: boolean,
  ): Promise<void> {
    const wasDanger = state.lastStatus === '위험';
    const isDanger = input.currentStatus === '위험' || input.remainingMinutes < 0;
    const hasReroute = input.rerouteOccurred === true;

    if ((!hasReroute && (!isDanger || wasDanger || state.rerouteSentAt)) || (hasReroute && input.rerouteCount !== undefined && state.lastRerouteCount === input.rerouteCount)) {
      return;
    }

    const dedupSuffix = hasReroute ? String(input.rerouteCount ?? input.nextRouteId ?? 'unknown') : 'danger';
    const claim = await this.claimNotification(input.trip.userId, input.trip.id, `trip:${input.trip.id}:reroute:${dedupSuffix}`, 'reroute');
    if (!claim || claim.disposition !== 'claimed') return;
    const delivery = await this.sendPush({
      to: pushToken,
      title: hasReroute ? '경로가 변경되었습니다' : '경로 재탐색 필요',
      body: hasReroute ? '교통 상황에 맞춰 더 나은 경로로 안내를 갱신했습니다.' : '지각 위험 상태입니다. 즉시 대체 경로를 확인하세요.',
      sound: vibrationEnabled ? 'default' : null,
      channelId: vibrationEnabled ? 'timefit' : 'timefit-silent',
      data: {
        type: hasReroute ? 'route_changed' : 'reroute',
        tripId: input.trip.id,
        remainingMinutes: input.remainingMinutes,
        ...(input.nextRouteId ? { nextRouteId: input.nextRouteId } : {}),
        ...(input.rerouteReason ? { reason: input.rerouteReason } : {}),
      },
    });

    const result = delivery.result;
    await this.finalizeNotification(claim.id, result === 'sent', delivery, pushToken);
    if (result !== 'sent') {
      if (this.shouldClearPushToken(result)) await this.clearInvalidToken(input.trip.userId, pushToken);
      return;
    }
    if (hasReroute) {
      state.lastRerouteCount = input.rerouteCount;
    } else {
      state.rerouteSentAt = new Date().toISOString();
    }

    this.logger.log(
      {
        event: 'trip.notification.reroute',
        tripId: input.trip.id,
        remainingMinutes: input.remainingMinutes,
      },
      NotificationService.name,
    );
  }

  private async getPrismaClient(): Promise<NotificationDbClient> {
    if (this.prisma) return this.prisma;
    const globalForPrisma = globalThis as unknown as { prisma?: NotificationDbClient };
    const prismaModule = (await import('@prisma/client')) as unknown as { PrismaClient: new () => NotificationDbClient };
    this.prisma = globalForPrisma.prisma ?? new prismaModule.PrismaClient();
    if (!globalForPrisma.prisma) globalForPrisma.prisma = this.prisma;
    return this.prisma;
  }

  async processPendingReceipts(): Promise<void> {
    const prisma = await this.getPrismaClient();
    const cutoff = new Date(Date.now() - 15 * 60_000);
    let pending: Array<{ id: string; userId: string; providerTicketId: string; providerPushToken?: string | null }>;
    try {
      pending = await prisma.notification.findMany({
        where: {
          status: 'sent',
          providerTicketId: { not: null },
          receiptCheckedAt: null,
          sentAt: { lt: cutoff },
        },
        take: 100,
      });
    } catch (error) {
      if (!this.isDbConnectionError(error)) throw error;
      this.logger.warn(
        {
          event: 'notification.receipts.db_unavailable',
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        NotificationService.name,
      );
      return;
    }
    if (pending.length === 0) return;

    let receipts: Record<string, ExpoNotificationReceipt>;
    try {
      receipts = await this.expoNotificationClient.getReceipts(pending.map((item) => item.providerTicketId));
    } catch (error) {
      this.logger.warn(
        {
          event: 'notification.receipts.fetch_failed',
          count: pending.length,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        NotificationService.name,
      );
      return;
    }

    for (const notification of pending) {
      const receipt = receipts[notification.providerTicketId];
      // Expo may not have produced a receipt yet. Leave it pending for the
      // next worker cycle instead of treating an absent receipt as success.
      if (!receipt) continue;

      const isDeviceNotRegistered = receipt.details?.error === 'DeviceNotRegistered';
      if (isDeviceNotRegistered && notification.providerPushToken) {
        await this.clearInvalidToken(notification.userId, notification.providerPushToken);
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: receipt.status === 'ok' ? 'sent' : 'failed',
          receiptCheckedAt: new Date(),
        },
      });

      this.logger.log(
        {
          event: 'notification.receipt.checked',
          notificationId: notification.id,
          status: receipt.status,
          error: receipt.details?.error ?? null,
        },
        NotificationService.name,
      );
    }
  }

  private async sendPush(message: Parameters<ExpoNotificationClient['send']>[0]): Promise<ExpoNotificationSendOutcome> {
    // Keep unit-test doubles and older integrations compatible while the
    // production client records the Expo ticket ID for receipt polling.
    const client = this.expoNotificationClient as ExpoNotificationClient & {
      sendWithTicket?: (input: Parameters<ExpoNotificationClient['send']>[0]) => Promise<ExpoNotificationSendOutcome>;
    };
    if (client.sendWithTicket) return client.sendWithTicket(message);
    return { result: await client.send(message) };
  }

  private async clearInvalidToken(userId: string, token: string): Promise<void> {
    const prisma = await this.getPrismaClient();
    await prisma.device.updateMany({ where: { userId, pushToken: token }, data: { pushToken: null } });
    await prisma.routine.updateMany({ where: { userId, expoPushToken: token }, data: { expoPushToken: null } });
    await prisma.trip.updateMany({ where: { userId, expoPushToken: token }, data: { expoPushToken: null } });
    this.logger.warn({ event: 'notification.push_token.cleared', userId }, NotificationService.name);
  }

  private shouldClearPushToken(result: ExpoNotificationSendResult): boolean {
    // `skipped` means the database contained a malformed/legacy token. Keep
    // it from being selected by future workers just like an Expo-invalidated
    // token.
    return result === 'invalid' || result === 'skipped';
  }

  private isDbConnectionError(error: unknown): boolean {
    const value = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const code = `${value?.code ?? ''} ${value?.cause?.code ?? ''}`.toUpperCase();
    const message = `${value?.message ?? ''} ${value?.cause?.message ?? ''}`.toLowerCase();
    return (
      code.includes('P1001') ||
      code.includes('ECONNREFUSED') ||
      message.includes("can't reach database server") ||
      message.includes('connect econnrefused')
    );
  }

  private async claimNotification(userId: string, tripId: string | undefined, dedupKey: string, eventType: string): Promise<NotificationClaim | null> {
    const prisma = await this.getPrismaClient();
    const existing = await prisma.notification.findUnique({ where: { dedupKey } });
    if (existing) {
      if (existing.status === 'sent') return { id: existing.id, disposition: 'already_sent' };

      const now = new Date();
      const staleBefore = new Date(now.getTime() - 5 * 60_000);
      const isRecentSending = existing.status === 'sending' && now.getTime() - existing.createdAt.getTime() < 5 * 60_000;
      if (isRecentSending) return { id: existing.id, disposition: 'in_flight' };

      const claimWhere = existing.status === 'sending'
        ? { id: existing.id, status: 'sending', scheduledAt: { lt: staleBefore } }
        : { id: existing.id, status: existing.status };
      const claimed = await prisma.notification.updateMany({
        where: claimWhere,
        data: { status: 'sending', sentAt: null, scheduledAt: now },
      });
      return claimed.count === 1 ? { id: existing.id, disposition: 'claimed' } : null;
    }
    try {
      const created = await prisma.notification.create({
        data: {
          userId,
          ...(tripId ? { tripId } : {}),
          dedupKey,
          eventType,
          channel: 'push',
          status: 'sending',
          scheduledAt: new Date(),
        },
      });
      return { id: created.id, disposition: 'claimed' };
    } catch {
      // A concurrent worker may have won the unique dedup-key race.
      return null;
    }
  }

  private async finalizeNotification(
    id: string,
    sent: boolean,
    delivery?: ExpoNotificationSendOutcome,
    pushToken?: string,
  ): Promise<void> {
    const prisma = await this.getPrismaClient();
    const providerData = delivery?.ticketId
      ? {
          providerTicketId: delivery.ticketId,
          providerPushToken: pushToken ?? null,
        }
      : {};
    await prisma.notification.update({
      where: { id },
      data: {
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : null,
        ...providerData,
      },
    });
    if (!sent) {
      this.logger.warn(
        { event: 'notification.send.failed', notificationId: id },
        NotificationService.name,
      );
    }
  }

  private toDateKey(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.appConfig.timeZone ?? 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
    return `${value('year')}-${value('month')}-${value('day')}`;
  }

  private toNotificationPreferences(row: NotificationPreferenceRow | null): NotificationPreferenceData {
    return {
      notificationEnabled: row?.notificationEnabled ?? true,
      departureLeadMinutes: row?.departureLeadMinutes ?? 5,
      delayNotificationEnabled: row?.delayNotificationEnabled ?? true,
      rerouteNotificationEnabled: row?.rerouteNotificationEnabled ?? true,
      vibrationEnabled: row?.vibrationEnabled ?? true,
    };
  }
}
