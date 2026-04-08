import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { RecommendationResult } from '../../recommendation/types/recommendation.types';
import type { TripEntity, TripLiveStatus } from '../../trips/types/trip.types';
import { ExpoNotificationClient } from '../integrations/expo-notification.client';

interface LiveNotificationInput {
  trip: TripEntity;
  currentStatus: TripLiveStatus;
  remainingMinutes: number;
  estimatedArrivalAt: string;
  delayMinutes: number;
}

interface NotificationState {
  departureSentAt?: string;
  lastDelayMinutes?: number;
  lastStatus?: TripLiveStatus;
  rerouteSentAt?: string;
}

interface RoutineNotificationInput {
  pushToken: string;
  routineId: string;
  title: string;
  body: string;
  recommendation: RecommendationResult;
}

@Injectable()
export class NotificationService {
  private readonly stateByTrip = new Map<string, NotificationState>();

  constructor(
    private readonly expoNotificationClient: ExpoNotificationClient,
    private readonly logger: SafeLogger,
  ) {}

  async handleTripLiveNotification(input: LiveNotificationInput): Promise<void> {
    const pushToken = input.trip.expoPushToken;
    if (!pushToken) {
      return;
    }

    const state = this.stateByTrip.get(input.trip.id) ?? {};

    await this.maybeSendDepartureNotification(input, state, pushToken);
    await this.maybeSendDelayNotification(input, state, pushToken);
    await this.maybeSendRerouteNotification(input, state, pushToken);

    state.lastDelayMinutes = input.delayMinutes;
    state.lastStatus = input.currentStatus;
    this.stateByTrip.set(input.trip.id, state);
  }

  async sendRoutineNotification(input: RoutineNotificationInput): Promise<void> {
    await this.expoNotificationClient.send({
      to: input.pushToken,
      title: input.title,
      body: input.body,
      data: {
        type: 'routine_recommendation',
        routineId: input.routineId,
        primaryRouteId: input.recommendation.primaryRoute.route.id,
        status: input.recommendation.status,
        nextAction: input.recommendation.nextAction,
      },
    });

    this.logger.log(
      {
        event: 'routine.notification.sent',
        routineId: input.routineId,
        primaryRouteId: input.recommendation.primaryRoute.route.id,
      },
      NotificationService.name,
    );
  }

  private async maybeSendDepartureNotification(
    input: LiveNotificationInput,
    state: NotificationState,
    pushToken: string,
  ): Promise<void> {
    if (state.departureSentAt) {
      return;
    }

    const departureAt = new Date(input.trip.departureAt).getTime();
    const now = Date.now();
    const minutesToDeparture = Math.floor((departureAt - now) / 60_000);

    if (minutesToDeparture > 10 || minutesToDeparture < -3) {
      return;
    }

    await this.expoNotificationClient.send({
      to: pushToken,
      title: '출발 알림',
      body: minutesToDeparture <= 0 ? '지금 출발할 시간입니다.' : `${minutesToDeparture}분 후 출발하세요.`,
      data: {
        type: 'departure',
        tripId: input.trip.id,
        departureAt: input.trip.departureAt,
      },
    });

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
  ): Promise<void> {
    const previousDelay = state.lastDelayMinutes ?? 0;
    const delayIncrease = input.delayMinutes - previousDelay;

    if (delayIncrease < 2) {
      return;
    }

    await this.expoNotificationClient.send({
      to: pushToken,
      title: '지연 증가 알림',
      body: `지연이 ${delayIncrease}분 증가했습니다. ETA를 확인하세요.`,
      data: {
        type: 'delay',
        tripId: input.trip.id,
        delayMinutes: input.delayMinutes,
        estimatedArrivalAt: input.estimatedArrivalAt,
      },
    });

    this.logger.log(
      {
        event: 'trip.notification.delay',
        tripId: input.trip.id,
        previousDelay,
        currentDelay: input.delayMinutes,
      },
      NotificationService.name,
    );
  }

  private async maybeSendRerouteNotification(
    input: LiveNotificationInput,
    state: NotificationState,
    pushToken: string,
  ): Promise<void> {
    const wasDanger = state.lastStatus === '위험';
    const isDanger = input.currentStatus === '위험' || input.remainingMinutes < 0;

    if (!isDanger || wasDanger || state.rerouteSentAt) {
      return;
    }

    await this.expoNotificationClient.send({
      to: pushToken,
      title: '경로 재탐색 필요',
      body: '지각 위험 상태입니다. 즉시 대체 경로를 확인하세요.',
      data: {
        type: 'reroute',
        tripId: input.trip.id,
        remainingMinutes: input.remainingMinutes,
      },
    });

    state.rerouteSentAt = new Date().toISOString();

    this.logger.log(
      {
        event: 'trip.notification.reroute',
        tripId: input.trip.id,
        remainingMinutes: input.remainingMinutes,
      },
      NotificationService.name,
    );
  }
}
