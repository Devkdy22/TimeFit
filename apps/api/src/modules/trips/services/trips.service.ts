import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { calculateTripLiveState } from '../../../domain/trip/trip-live.calculator';
import { NotificationService } from '../../notifications/services/notification.service';
import { SeoulBusClient } from '../../recommendation/integrations/seoul-bus.client';
import { SeoulSubwayClient } from '../../recommendation/integrations/seoul-subway.client';
import { TrafficClient } from '../../recommendation/integrations/traffic.client';
import { WeatherClient } from '../../recommendation/integrations/weather.client';
import { StartTripDto } from '../dto/start-trip.dto';
import type { TripEntity } from '../types/trip.types';
import { TripsRepository } from './trips.repository';

@Injectable()
export class TripsService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly seoulBusClient: SeoulBusClient,
    private readonly seoulSubwayClient: SeoulSubwayClient,
    private readonly trafficClient: TrafficClient,
    private readonly weatherClient: WeatherClient,
    private readonly notificationService: NotificationService,
    private readonly logger: SafeLogger,
  ) {}

  startTrip(input: StartTripDto) {
    const startedAt = input.startedAt ?? new Date().toISOString();

    const trip = this.tripsRepository.create({
      userId: input.userId,
      recommendationId: input.recommendationId,
      startedAt,
      currentRoute: input.currentRoute?.trim() || input.recommendationId,
      departureAt: input.departureAt,
      arrivalAt: input.arrivalAt,
      expoPushToken: input.expoPushToken,
      plannedDurationMinutes: input.plannedDurationMinutes,
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      stationName: input.stationName,
    });

    return {
      id: trip.id,
      userId: trip.userId,
      recommendationId: trip.recommendationId,
      status: trip.status,
      startedAt: trip.startedAt,
      currentRoute: trip.currentRoute,
      departureAt: trip.departureAt,
      arrivalAt: trip.arrivalAt,
      expoPushTokenRegistered: Boolean(trip.expoPushToken),
      expectedArrivalAt: trip.expectedArrivalAt,
      stationName: trip.stationName,
    };
  }

  async getLive(tripId: string) {
    const trip = this.tripsRepository.findById(tripId);
    const previousStatus = trip.status;
    const now = new Date();
    const delay = await this.getRealtimeDelay(trip);
    const snapshot = calculateTripLiveState(trip, now, delay.delayMinutes);

    const updated = this.tripsRepository.updateStatus(
      trip.id,
      this.mapLiveStatusToTripStatus(snapshot.currentStatus, snapshot.bufferMinutes),
    );

    this.logger.log(
      {
        event: 'trip.recalculation',
        tripId: updated.id,
        startedAt: updated.startedAt,
        currentRoute: updated.currentRoute,
        arrivalAt: updated.arrivalAt,
        remainingMinutes: snapshot.remainingMinutes,
        estimatedArrivalAt: snapshot.estimatedArrivalAt,
        delayMinutes: snapshot.delayMinutes,
        delayRisk: delay.combinedDelayRisk,
      },
      TripsService.name,
    );

    if (previousStatus !== updated.status) {
      this.logger.log(
        {
          event: 'trip.status.change',
          tripId: updated.id,
          from: previousStatus,
          to: updated.status,
          currentStatus: snapshot.currentStatus,
          remainingMinutes: snapshot.remainingMinutes,
          bufferMinutes: snapshot.bufferMinutes,
        },
        TripsService.name,
      );
    }

    await this.notificationService.handleTripLiveNotification({
      trip: updated,
      currentStatus: snapshot.currentStatus,
      remainingMinutes: snapshot.remainingMinutes,
      estimatedArrivalAt: snapshot.estimatedArrivalAt,
      delayMinutes: snapshot.delayMinutes,
    });

    return {
      tripId: updated.id,
      startedAt: updated.startedAt,
      currentRoute: updated.currentRoute,
      departureAt: updated.departureAt,
      arrivalAt: updated.arrivalAt,
      remainingMinutes: snapshot.remainingMinutes,
      currentStatus: snapshot.currentStatus,
      nextAction: snapshot.nextAction,
      urgencyLevel: snapshot.urgencyLevel,
      bufferMinutes: snapshot.bufferMinutes,
      estimatedArrivalAt: snapshot.estimatedArrivalAt,
      delayMinutes: snapshot.delayMinutes,
      delayRisk: delay.combinedDelayRisk,
      delayComponents: {
        bus: delay.busDelayRisk,
        subway: delay.subwayDelayRisk,
        road: delay.roadDelayRisk,
        weather: delay.weatherDelayRisk,
      },
      rerouteRecommended: snapshot.remainingMinutes < 0,
      pollingIntervalMs: 15000,
    };
  }

  private async getRealtimeDelay(trip: TripEntity): Promise<{
    busDelayRisk: number;
    subwayDelayRisk: number;
    roadDelayRisk: number;
    weatherDelayRisk: number;
    combinedDelayRisk: number;
    delayMinutes: number;
  }> {
    const originLat = trip.originLat ?? 37.5665;
    const originLng = trip.originLng ?? 126.978;
    const destinationLat = trip.destinationLat ?? originLat;
    const destinationLng = trip.destinationLng ?? originLng;
    const stationName = (trip.stationName ?? '').trim();

    const busDelayRisk = await this.getBusDelayRisk(originLat, originLng);
    const subwayDelayRisk = await this.getSubwayDelayRisk(stationName);
    const roadDelayRisk = await this.getRoadDelayRisk(
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    );
    const weatherDelayRisk = await this.getWeatherDelayRisk(
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    );

    const combinedDelayRisk = this.clamp01(
      busDelayRisk * 0.35 + subwayDelayRisk * 0.25 + roadDelayRisk * 0.25 + weatherDelayRisk * 0.15,
    );

    const delayMinutes = Math.max(0, Math.round(combinedDelayRisk * 12));

    this.logger.log(
      {
        event: 'trip.live.delay.refresh',
        tripId: trip.id,
        busDelayRisk,
        subwayDelayRisk,
        roadDelayRisk,
        weatherDelayRisk,
        combinedDelayRisk,
        delayMinutes,
      },
      TripsService.name,
    );

    return {
      busDelayRisk,
      subwayDelayRisk,
      roadDelayRisk,
      weatherDelayRisk,
      combinedDelayRisk,
      delayMinutes,
    };
  }

  private async getBusDelayRisk(lat: number, lng: number): Promise<number> {
    try {
      const station = await this.seoulBusClient.getNearestStation(lat, lng);
      if (!station) {
        return 0.15;
      }
      const arrival = await this.seoulBusClient.getArrival(station.stationId);
      return this.clamp01(arrival.delayRisk);
    } catch {
      return 0.15;
    }
  }

  private async getSubwayDelayRisk(stationName: string): Promise<number> {
    if (!stationName) {
      return 0.1;
    }
    try {
      const arrival = await this.seoulSubwayClient.getSubwayArrival(stationName);
      return this.clamp01(arrival.delayRisk);
    } catch {
      return 0.1;
    }
  }

  private async getRoadDelayRisk(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): Promise<number> {
    try {
      const traffic = await this.trafficClient.getTrafficDelay(
        { name: 'origin', lat: originLat, lng: originLng },
        { name: 'destination', lat: destinationLat, lng: destinationLng },
      );
      return this.clamp01(traffic.congestionIndex);
    } catch {
      return 0.2;
    }
  }

  private async getWeatherDelayRisk(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): Promise<number> {
    try {
      const weather = await this.weatherClient.getWeatherDelayFactor(
        { name: 'origin', lat: originLat, lng: originLng },
        { name: 'destination', lat: destinationLat, lng: destinationLng },
      );
      return this.clamp01(weather.severityIndex);
    } catch {
      return 0.1;
    }
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private mapLiveStatusToTripStatus(
    status: '여유' | '주의' | '긴급' | '위험',
    bufferMinutes: number,
  ): TripEntity['status'] {
    if (bufferMinutes < 0 || status === '위험') {
      return 'rerouting';
    }
    if (status === '긴급') {
      return 'urgent';
    }
    if (status === '주의') {
      return 'caution';
    }
    return 'moving';
  }
}
