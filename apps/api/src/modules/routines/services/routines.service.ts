import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { RecommendationService } from '../../recommendation/services/recommendation.service';
import { RoutinesRepository } from './routines.repository';
import { CreateRoutineDto, UpdateRoutineDto } from '../dto/create-routine.dto';
import type { RoutineEntity } from '../types/routine.types';
import type { RecommendationResult, RecommendationResponse } from '../../recommendation/types/recommendation.types';

@Injectable()
export class RoutinesService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private processingAutomations = false;

  constructor(
    private readonly routinesRepository: RoutinesRepository,
    private readonly recommendationService: RecommendationService,
    private readonly notificationService: NotificationService,
    private readonly logger: SafeLogger,
    private readonly appConfig: AppConfigService,
  ) {}

  onModuleInit() {
    // Run once immediately so a restart during the notification window does
    // not have to wait for the first interval tick.
    void this.processAutomations();
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

  async createRoutine(userId: string, input: CreateRoutineDto): Promise<RoutineEntity> {
    const registeredPushToken = input.expoPushToken ?? await this.notificationService.getRegisteredPushToken(userId);
    return this.routinesRepository.create({
      userId,
      title: input.title,
      origin: input.origin,
      destination: input.destination,
      weekdays: input.weekdays,
      arrivalTime: input.arrivalTime,
      timeMode: input.timeMode ?? 'arrival',
      bufferMinutes: input.bufferMinutes ?? 0,
      preferredMode: input.preferredMode ?? 'any',
      excludedDates: input.excludedDates ?? [],
      notificationEnabled: input.notificationEnabled ?? true,
      notificationMinutesBefore: input.notificationMinutesBefore ?? 10,
      favorite: input.favorite ?? false,
      active: input.active ?? true,
      savedRoute: input.savedRoute
        ? {
            ...input.savedRoute,
            source: 'api',
          }
        : undefined,
      expoPushToken: registeredPushToken,
    });
  }

  listRoutines(userId: string): Promise<RoutineEntity[]> {
    return this.routinesRepository.findByUser(userId);
  }

  updateRoutine(userId: string, routineId: string, input: UpdateRoutineDto): Promise<RoutineEntity> {
    return this.routinesRepository.updateOwned(userId, routineId, {
      title: input.title,
      origin: input.origin,
      destination: input.destination,
      weekdays: input.weekdays,
      arrivalTime: input.arrivalTime,
      timeMode: input.timeMode,
      bufferMinutes: input.bufferMinutes,
      preferredMode: input.preferredMode,
      excludedDates: input.excludedDates,
      notificationEnabled: input.notificationEnabled,
      notificationMinutesBefore: input.notificationMinutesBefore,
      favorite: input.favorite,
      active: input.active,
      savedRoute: input.savedRoute
        ? {
            ...input.savedRoute,
            source: 'api',
          }
        : undefined,
      expoPushToken: input.expoPushToken,
    });
  }

  deleteRoutine(userId: string, routineId: string): Promise<void> {
    return this.routinesRepository.deleteOwned(userId, routineId);
  }

  async runRoutineNow(userId: string, routineId: string) {
    const routine = await this.routinesRepository.findOwned(userId, routineId);
    return this.executeRoutine(routine, new Date());
  }

  private async processAutomations() {
    if (this.processingAutomations) {
      return;
    }

    this.processingAutomations = true;
    const now = new Date();
    try {
      await this.notificationService.processPendingReceipts();
      const active = await this.routinesRepository.findActive();

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

        try {
          await this.executeRoutine(routine, now);
        } catch (error) {
          this.logger.warn(
            {
              event: 'routine.automation.failed',
              routineId: routine.id,
              userId: routine.userId,
              reason: error instanceof Error ? error.message : 'unknown_error',
            },
            RoutinesService.name,
          );
        }
      }
    } catch (error) {
      if (!this.isDbConnectionError(error)) {
        throw error;
      }
      this.logger.warn(
        {
          event: 'routine.automation.db_unavailable',
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
        RoutinesService.name,
      );
    } finally {
      this.processingAutomations = false;
    }
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

  private async executeRoutine(routine: RoutineEntity, now: Date) {
    const targetAt = this.buildTargetDate(now, routine.arrivalTime);
    const estimatedTravelMinutes = routine.savedRoute?.estimatedTravelMinutes ?? 45;
    const arrivalAt = routine.timeMode === 'departure'
      ? new Date(targetAt.getTime() + (estimatedTravelMinutes + routine.bufferMinutes) * 60_000)
      : targetAt;

    const recommendation = await this.recommendationService.recommend({
      origin: routine.origin,
      destination: routine.destination,
      arrivalAt: arrivalAt.toISOString(),
      candidateRoutes: routine.savedRoute ? [routine.savedRoute] : undefined,
      userPreference: {
        prepMinutes: routine.timeMode === 'departure' ? 0 : 8,
        preferredBufferMinutes: Math.max(4, routine.bufferMinutes),
        preferredMode: routine.preferredMode,
        transferPenaltyWeight: 1,
        walkingPenaltyWeight: 1,
      },
    });

    if (routine.notificationEnabled && routine.expoPushToken && this.isRecommendationResult(recommendation)) {
      const deliveryResult = await this.notificationService.sendRoutineNotification({
        userId: routine.userId,
        pushToken: routine.expoPushToken,
        routineId: routine.id,
        title: `${routine.title} 추천 생성`,
        body: recommendation.nextAction,
        recommendation,
      });
      // A transient provider/network failure must remain eligible for the
      // next worker tick. The notification dedup record is already marked
      // failed and can be claimed again by NotificationService.
      if (deliveryResult === 'failed' || deliveryResult === 'in_flight') {
        this.logger.warn(
          {
            event: 'routine.automation.notification_retry_pending',
            routineId: routine.id,
            userId: routine.userId,
          },
          RoutinesService.name,
        );
        return recommendation;
      }
    }

    await this.routinesRepository.markTriggered(routine.id, now.toISOString());

    if (this.isRecommendationResult(recommendation)) {
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
    } else {
      this.logger.warn(
        {
          event: 'routine.automation.empty',
          routineId: routine.id,
          userId: routine.userId,
          arrivalAt: arrivalAt.toISOString(),
          emptyState: recommendation.emptyState,
        },
        RoutinesService.name,
      );
    }

    return recommendation;
  }

  private isDueToday(routine: RoutineEntity, now: Date): boolean {
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(this.getTimeZoneDateParts(now).weekday);
    return routine.weekdays.includes(weekday) && !routine.excludedDates.includes(this.toDateKey(now));
  }

  private isWithinTriggerWindow(routine: RoutineEntity, now: Date): boolean {
    const targetAt = this.buildTargetDate(now, routine.arrivalTime);
    const minutesUntilTarget = Math.floor((targetAt.getTime() - now.getTime()) / 60_000);
    const leadMinutes = Math.max(0, routine.notificationMinutesBefore);

    // The worker runs once per minute; a one-minute tolerance avoids missing
    // the configured notification time because of scheduler jitter. The same
    // rule applies to arrival- and departure-targeted routines.
    return minutesUntilTarget <= leadMinutes && minutesUntilTarget >= leadMinutes - 1;
  }

  private alreadyTriggeredToday(routine: RoutineEntity, now: Date): boolean {
    if (!routine.lastTriggeredAt) {
      return false;
    }
    return this.toDateKey(new Date(routine.lastTriggeredAt)) === this.toDateKey(now);
  }

  private buildTargetDate(base: Date, hhmm: string): Date {
    const [hourRaw, minuteRaw] = hhmm.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    const targetHour = Number.isFinite(hour) ? hour : 9;
    const targetMinute = Number.isFinite(minute) ? minute : 0;
    const timeZone = this.appConfig.timeZone ?? 'Asia/Seoul';
    const { year, month, day } = this.getTimeZoneDateParts(base);
    const wallClockGuess = Date.UTC(year, month - 1, day, targetHour, targetMinute, 0, 0);
    const offsetParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(wallClockGuess));
    const offsetPart = (type: string) => Number(offsetParts.find((value) => value.type === type)?.value ?? 0);
    const zoneAsUtc = Date.UTC(offsetPart('year'), offsetPart('month') - 1, offsetPart('day'), offsetPart('hour'), offsetPart('minute'), offsetPart('second'));
    return new Date(wallClockGuess - (zoneAsUtc - wallClockGuess));
  }

  private toDateKey(date: Date): string {
    const parts = this.getTimeZoneDateParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private getTimeZoneDateParts(date: Date): { year: number; month: number; day: number; weekday: string } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.appConfig.timeZone ?? 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
    return {
      year: Number(value('year')),
      month: Number(value('month')),
      day: Number(value('day')),
      weekday: value('weekday'),
    };
  }

  private isRecommendationResult(
    response: RecommendationResponse,
  ): response is RecommendationResult {
    return 'primaryRoute' in response;
  }
}
