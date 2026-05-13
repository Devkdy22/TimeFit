import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import { EventBus } from '../../../../core/EventBus';
import type { LocationInput, MobilityRoute, RealtimeStatus } from '../../types/recommendation.types';
import { mapResponseToRoutes } from '../../adapters/odsayRouteAdapter';
import { OdsayTransitClient } from './OdsayTransitClient';
import { TransitRealtimeOrchestrator } from './TransitRealtimeOrchestrator';

export interface RealtimeStateInput {
  realtimeSegments: Array<{
    index: number;
    realtimeStatus?: RealtimeStatus;
    delayMinutes?: number;
    etaMinutes?: number;
  }>;
  delayMinutes?: number;
  previousDelayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  currentDelayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  bufferMinutes?: number;
  currentTime?: string;
}

export interface CurrentPositionInput {
  lat: number;
  lng: number;
}

export interface ReRouteEvaluationResult {
  keepCurrent: boolean;
  nextBestRoute: MobilityRoute | null;
  reason: string;
}

export interface ReRouteOptions {
  force?: boolean;
  forceReason?: string;
}

@Injectable()
export class ReRoutingEngine {
  private readonly debounceMs = 15_000;
  private readonly lastEvaluateAtByRouteId = new Map<string, number>();
  private readonly lastSuggestedSignatureByRouteId = new Map<string, string>();

  constructor(
    private readonly logger: SafeLogger,
    private readonly eventBus: EventBus,
    private readonly odsayTransitClient: OdsayTransitClient,
    private readonly transitRealtimeOrchestrator: TransitRealtimeOrchestrator,
  ) {}

  async evaluateReRoute(
    currentRoute: MobilityRoute,
    realtimeState: RealtimeStateInput,
    currentPosition: CurrentPositionInput,
    options?: ReRouteOptions,
  ): Promise<ReRouteEvaluationResult> {
    const nowMs = this.resolveNow(realtimeState.currentTime);
    const lastEvaluateAt = this.lastEvaluateAtByRouteId.get(currentRoute.id);
    if (lastEvaluateAt && nowMs - lastEvaluateAt < this.debounceMs) {
      return {
        keepCurrent: true,
        nextBestRoute: null,
        reason: 'debounced',
      };
    }

    this.lastEvaluateAtByRouteId.set(currentRoute.id, nowMs);
    const triggerReason = options?.force
      ? options.forceReason ?? 'forced'
      : this.resolveTriggerReason(currentRoute, realtimeState);
    if (!triggerReason) {
      return {
        keepCurrent: true,
        nextBestRoute: null,
        reason: 'no_reroute_trigger',
      };
    }

    const destination = this.resolveDestination(currentRoute);
    if (!destination) {
      return {
        keepCurrent: true,
        nextBestRoute: null,
        reason: 'missing_destination_coordinates',
      };
    }

    try {
      const origin: LocationInput = {
        name: '현재 위치',
        lat: currentPosition.lat,
        lng: currentPosition.lng,
      };
      const odsay = await this.odsayTransitClient.fetchTransitRoutes(origin, destination);
      if (odsay.status && odsay.status !== 'OK') {
        return {
          keepCurrent: true,
          nextBestRoute: null,
          reason: `reroute_triggered:${triggerReason}:provider_status_${odsay.status.toLowerCase()}`,
        };
      }
      const mapped = mapResponseToRoutes(odsay.paths, origin, destination, this.logger);
      const patched = await this.transitRealtimeOrchestrator.applyRealtime(mapped.routes);
      const nextBest = this.pickBestRoute(patched);

      if (!nextBest) {
        return {
          keepCurrent: true,
          nextBestRoute: null,
          reason: `reroute_triggered:${triggerReason}:no_alternative`,
        };
      }

      const currentScore = this.computeRouteScore(currentRoute);
      const nextScore = this.computeRouteScore(nextBest);
      const improvement = nextScore - currentScore;

      const signature = this.computeRouteSignature(nextBest);
      const lastSignature = this.lastSuggestedSignatureByRouteId.get(currentRoute.id);
      if (lastSignature === signature) {
        return {
          keepCurrent: true,
          nextBestRoute: null,
          reason: `reroute_triggered:${triggerReason}:duplicate_result_suppressed`,
        };
      }

      if (improvement < 4) {
        return {
          keepCurrent: true,
          nextBestRoute: null,
          reason: `reroute_triggered:${triggerReason}:insufficient_improvement`,
        };
      }

      this.lastSuggestedSignatureByRouteId.set(currentRoute.id, signature);

      this.logger.log(
        {
          event: 'transit.reroute.applied',
          currentRouteId: currentRoute.id,
          nextRouteId: nextBest.id,
          triggerReason,
          currentScore,
          nextScore,
          improvement,
        },
        ReRoutingEngine.name,
      );
      this.eventBus.emit('REROUTE_TRIGGERED', {
        tripId: currentRoute.id,
        routeId: currentRoute.id,
        reason: `reroute_triggered:${triggerReason}:better_route_found`,
        keepCurrent: false,
      });

      return {
        keepCurrent: false,
        nextBestRoute: nextBest,
        reason: `reroute_triggered:${triggerReason}:better_route_found`,
      };
    } catch (error) {
      this.eventBus.emit('REROUTE_TRIGGERED', {
        tripId: currentRoute.id,
        routeId: currentRoute.id,
        reason: `reroute_triggered:${triggerReason}:request_failed`,
        keepCurrent: true,
      });
      return {
        keepCurrent: true,
        nextBestRoute: null,
        reason: `reroute_triggered:${triggerReason}:request_failed`,
      };
    }
  }

  private resolveTriggerReason(
    currentRoute: MobilityRoute,
    realtimeState: RealtimeStateInput,
  ): 'first_segment_missed' | 'delay_spike' | 'delay_risk_up' | 'buffer_low' | null {
    const firstSegment = currentRoute.mobilitySegments?.[0];
    const firstRealtime = realtimeState.realtimeSegments.find((segment) => segment.index === 0);
    const firstSegmentMissed =
      firstSegment !== undefined &&
      (firstRealtime?.realtimeStatus === 'DELAYED' ||
        (firstRealtime?.etaMinutes ?? 0) > Math.max(3, firstSegment.durationMinutes));

    if (firstSegmentMissed) {
      return 'first_segment_missed';
    }

    if ((realtimeState.delayMinutes ?? 0) > 5) {
      return 'delay_spike';
    }

    if (
      realtimeState.previousDelayRiskLevel === 'LOW' &&
      realtimeState.currentDelayRiskLevel === 'HIGH'
    ) {
      return 'delay_risk_up';
    }

    if ((realtimeState.bufferMinutes ?? 999) < 2) {
      return 'buffer_low';
    }

    return null;
  }

  private resolveDestination(route: MobilityRoute): LocationInput | null {
    const segments = route.mobilitySegments ?? [];
    const last = segments[segments.length - 1];
    if (!last || last.endLat === undefined || last.endLng === undefined) {
      return null;
    }

    return {
      name: last.endName ?? '목적지',
      lat: last.endLat,
      lng: last.endLng,
    };
  }

  private computeRouteScore(route: MobilityRoute): number {
    if (typeof route.score === 'number' && Number.isFinite(route.score)) {
      return route.score;
    }

    const duration = route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes;
    const riskPenalty = route.delayRisk * 20;
    const transferPenalty = route.transferCount * 6;
    const walkingPenalty = route.walkingMinutes * 0.4;
    const coverageBonus = (route.realtimeCoverage ?? 0) * 8;

    return 100 - duration * 0.8 - riskPenalty - transferPenalty - walkingPenalty + coverageBonus;
  }

  private pickBestRoute(routes: MobilityRoute[]): MobilityRoute | null {
    const sorted = [...routes].sort((left, right) => this.computeRouteScore(right) - this.computeRouteScore(left));
    return sorted[0] ?? null;
  }

  private computeRouteSignature(route: MobilityRoute): string {
    const modeChain = (route.mobilitySegments ?? []).map((segment) => segment.mode).join('>');
    const duration = route.realtimeAdjustedDurationMinutes ?? route.estimatedTravelMinutes;
    return `${route.id}:${modeChain}:${duration}:${route.transferCount}`;
  }

  private resolveNow(currentTime: string | undefined): number {
    if (!currentTime) {
      return Date.now();
    }

    const parsed = Date.parse(currentTime);
    if (Number.isNaN(parsed)) {
      return Date.now();
    }

    return parsed;
  }
}
