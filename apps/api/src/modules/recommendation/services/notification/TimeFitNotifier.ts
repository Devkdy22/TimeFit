import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import type { MobilityRoute } from '../../types/recommendation.types';

export type TimeFitNotificationType =
  | 'STATUS_DOWNGRADED'
  | 'DELAY_SPIKE'
  | 'BUS_ARRIVING_SOON';

export interface TimeFitNotificationEvent {
  type: TimeFitNotificationType;
  routeId: string;
  message: string;
  createdAt: string;
  pushPayload?: {
    title: string;
    body: string;
  };
}

export interface TimeFitNotifierInput {
  route: MobilityRoute;
  previousStatus: '여유' | '주의' | '긴급';
  nextStatus: '여유' | '주의' | '긴급';
  previousDelayMinutes: number;
  nextDelayMinutes: number;
}

@Injectable()
export class TimeFitNotifier {
  private readonly emitter = new EventEmitter();

  constructor(private readonly logger: SafeLogger) {}

  onInAppEvent(listener: (event: TimeFitNotificationEvent) => void): () => void {
    this.emitter.on('timefit_notification', listener);
    return () => {
      this.emitter.off('timefit_notification', listener);
    };
  }

  evaluate(input: TimeFitNotifierInput): TimeFitNotificationEvent[] {
    const events: TimeFitNotificationEvent[] = [];

    if (isStatusDowngraded(input.previousStatus, input.nextStatus)) {
      const message =
        input.nextStatus === '긴급'
          ? '지금 출발해야 합니다'
          : '시간 여유가 줄었습니다. 준비를 시작하세요';

      events.push(
        this.emit({
          type: 'STATUS_DOWNGRADED',
          routeId: input.route.id,
          message,
          createdAt: new Date().toISOString(),
          pushPayload: {
            title: 'TimeFit 상태 변경',
            body: message,
          },
        }),
      );
    }

    if (input.nextDelayMinutes - input.previousDelayMinutes >= 3) {
      events.push(
        this.emit({
          type: 'DELAY_SPIKE',
          routeId: input.route.id,
          message: '지연 발생, 다른 경로를 추천합니다',
          createdAt: new Date().toISOString(),
          pushPayload: {
            title: '지연 증가',
            body: '지연 발생, 다른 경로를 추천합니다',
          },
        }),
      );
    }

    const firstBusSegment = (input.route.mobilitySegments ?? []).find((segment) => segment.mode === 'bus');
    const etaMinutes = firstBusSegment?.realtimeInfo?.etaMinutes;
    if (etaMinutes !== undefined && etaMinutes <= 2) {
      events.push(
        this.emit({
          type: 'BUS_ARRIVING_SOON',
          routeId: input.route.id,
          message: '버스가 곧 도착합니다. 탑승 준비하세요',
          createdAt: new Date().toISOString(),
          pushPayload: {
            title: '버스 도착 임박',
            body: '버스가 곧 도착합니다. 탑승 준비하세요',
          },
        }),
      );
    }

    return events;
  }

  private emit(event: TimeFitNotificationEvent): TimeFitNotificationEvent {
    this.logger.log(
      {
        event: 'timefit.notification',
        type: event.type,
        routeId: event.routeId,
        message: event.message,
      },
      TimeFitNotifier.name,
    );

    this.emitter.emit('timefit_notification', event);
    return event;
  }
}

function isStatusDowngraded(
  previousStatus: '여유' | '주의' | '긴급',
  nextStatus: '여유' | '주의' | '긴급',
): boolean {
  const rank = {
    여유: 0,
    주의: 1,
    긴급: 2,
  } as const;

  return rank[nextStatus] > rank[previousStatus];
}
