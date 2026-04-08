import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { RecommendationService } from '../../recommendation/services/recommendation.service';
import { RoutinesRepository } from './routines.repository';
import { CreateRoutineDto } from '../dto/create-routine.dto';
import type { RoutineEntity } from '../types/routine.types';

@Injectable()
export class RoutinesService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly routinesRepository: RoutinesRepository,
    private readonly recommendationService: RecommendationService,
    private readonly notificationService: NotificationService,
    private readonly logger: SafeLogger,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processAutomations();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  createRoutine(input: CreateRoutineDto): RoutineEntity {
    return this.routinesRepository.create({
      userId: input.userId,
      title: input.title,
      origin: input.origin,
      destination: input.destination,
      weekdays: input.weekdays,
      arrivalTime: input.arrivalTime,
      savedRoute: input.savedRoute
        ? {
            ...input.savedRoute,
            source: 'api',
          }
        : undefined,
      expoPushToken: input.expoPushToken,
    });
  }

  listRoutines(userId: string): RoutineEntity[] {
    return this.routinesRepository.findByUser(userId);
  }

  async runRoutineNow(routineId: string) {
    const routine = this.routinesRepository.findById(routineId);
    return this.executeRoutine(routine, new Date());
  }

  private async processAutomations() {
    const now = new Date();
    const active = this.routinesRepository.findActive();

    for (const routine of active) {
      if (!this.isDueToday(routine, now)) {
        continue;
      }

      if (!this.isWithinTriggerWindow(routine, now)) {
        continue;
      }

      if (this.alreadyTriggeredToday(routine, now)) {
        continue;
      }

      await this.executeRoutine(routine, now);
    }
  }

  private async executeRoutine(routine: RoutineEntity, now: Date) {
    const arrivalAt = this.buildArrivalDate(now, routine.arrivalTime);

    const recommendation = await this.recommendationService.recommend({
      origin: routine.origin,
      destination: routine.destination,
      arrivalAt: arrivalAt.toISOString(),
      candidateRoutes: routine.savedRoute ? [routine.savedRoute] : undefined,
      userPreference: {
        prepMinutes: 8,
        preferredBufferMinutes: 4,
        transferPenaltyWeight: 1,
        walkingPenaltyWeight: 1,
      },
    });

    this.routinesRepository.markTriggered(routine.id, now.toISOString());

    if (routine.expoPushToken) {
      await this.notificationService.sendRoutineNotification({
        pushToken: routine.expoPushToken,
        routineId: routine.id,
        title: `${routine.title} 추천 생성`,
        body: recommendation.nextAction,
        recommendation,
      });
    }

    this.logger.log(
      {
        event: 'routine.automation.generated',
        routineId: routine.id,
        userId: routine.userId,
        arrivalAt: arrivalAt.toISOString(),
        primaryRouteId: recommendation.primaryRoute.route.id,
        status: recommendation.status,
      },
      RoutinesService.name,
    );

    return recommendation;
  }

  private isDueToday(routine: RoutineEntity, now: Date): boolean {
    return routine.weekdays.includes(now.getDay());
  }

  private isWithinTriggerWindow(routine: RoutineEntity, now: Date): boolean {
    const arrivalAt = this.buildArrivalDate(now, routine.arrivalTime);
    const minutesUntilArrival = Math.floor((arrivalAt.getTime() - now.getTime()) / 60_000);

    // Trigger between 120 minutes and 5 minutes before arrival.
    return minutesUntilArrival <= 120 && minutesUntilArrival >= 5;
  }

  private alreadyTriggeredToday(routine: RoutineEntity, now: Date): boolean {
    if (!routine.lastTriggeredAt) {
      return false;
    }
    const last = new Date(routine.lastTriggeredAt);
    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate()
    );
  }

  private buildArrivalDate(base: Date, hhmm: string): Date {
    const [hourRaw, minuteRaw] = hhmm.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    const date = new Date(base);
    date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
    return date;
  }
}
