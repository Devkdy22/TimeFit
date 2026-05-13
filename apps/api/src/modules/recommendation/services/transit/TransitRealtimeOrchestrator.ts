import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../common/config/app-config.service';
import type { DelayRiskLevel, MobilitySegment, RouteCandidate } from '../../types/recommendation.types';
import { BusRealtimeProvider } from './BusRealtimeProvider';
import { SubwayRealtimeProvider } from './SubwayRealtimeProvider';

@Injectable()
export class TransitRealtimeOrchestrator {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly busRealtimeProvider: BusRealtimeProvider,
    private readonly subwayRealtimeProvider: SubwayRealtimeProvider,
  ) {}

  async applyRealtime(routes: RouteCandidate[]): Promise<RouteCandidate[]> {
    return Promise.all(routes.map((route) => this.patchRoute(route)));
  }

  private async patchRoute(route: RouteCandidate): Promise<RouteCandidate> {
    const segments = route.mobilitySegments ?? [];
    const patchedSegments: MobilitySegment[] = [];

    for (const segment of segments) {
      if (segment.mode === 'bus') {
        patchedSegments.push(await this.busRealtimeProvider.patchSegment(segment));
        continue;
      }

      if (segment.mode === 'subway') {
        patchedSegments.push(await this.subwayRealtimeProvider.patchSegment(segment));
        continue;
      }

      patchedSegments.push({
        ...segment,
        realtimeAdjustedDurationMinutes: segment.durationMinutes,
        delayMinutes: 0,
        realtimeStatus: 'SCHEDULED',
      });
    }

    const transferBufferMinutes = this.getTransferBufferMinutes();
    const adjustedTravelMinutes = this.recalculateTotalEta(patchedSegments, route.transferCount, transferBufferMinutes);
    const delayMinutes = Math.max(0, adjustedTravelMinutes - route.estimatedTravelMinutes);
    const realtimeCoverage = this.computeRealtimeCoverage(patchedSegments);
    const delayRisk = this.computeDelayRisk(route.transferCount, delayMinutes, realtimeCoverage);

    return {
      ...route,
      mobilitySegments: patchedSegments,
      realtimeAdjustedDurationMinutes: adjustedTravelMinutes,
      delayRisk,
      delayRiskLevel: this.toDelayRiskLevel(delayRisk),
      confidenceScore: this.computeConfidenceScore(realtimeCoverage, delayRisk),
      realtimeCoverage,
      score: this.computeRouteScore(
        adjustedTravelMinutes,
        route.transferCount,
        route.walkingMinutes,
        delayRisk,
        realtimeCoverage,
      ),
    };
  }

  private recalculateTotalEta(
    segments: MobilitySegment[],
    transferCount: number,
    transferBufferMinutes: number,
  ): number {
    const segmentMinutes = segments.reduce(
      (sum, segment) => sum + (segment.realtimeAdjustedDurationMinutes ?? segment.durationMinutes),
      0,
    );

    return Math.max(1, Math.round(segmentMinutes + transferCount * transferBufferMinutes));
  }

  private computeRealtimeCoverage(segments: MobilitySegment[]): number {
    const transitSegments = segments.filter((segment) => segment.mode === 'bus' || segment.mode === 'subway');
    if (transitSegments.length === 0) {
      return 1;
    }

    const liveSegments = transitSegments.filter(
      (segment) => segment.realtimeStatus === 'LIVE' || segment.realtimeStatus === 'DELAYED',
    ).length;

    return Number((liveSegments / transitSegments.length).toFixed(2));
  }

  private computeDelayRisk(transferCount: number, delayMinutes: number, realtimeCoverage: number): number {
    const transferRisk = transferCount * 0.08;
    const realtimeGapRisk = (1 - realtimeCoverage) * 0.35;
    const delayRisk = Math.min(0.9, delayMinutes * 0.03);
    const total = 0.08 + transferRisk + realtimeGapRisk + delayRisk;

    return Math.max(0.01, Math.min(0.99, Number(total.toFixed(3))));
  }

  private toDelayRiskLevel(delayRisk: number): DelayRiskLevel {
    if (delayRisk >= 0.6) {
      return 'HIGH';
    }
    if (delayRisk >= 0.3) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private computeConfidenceScore(realtimeCoverage: number, delayRisk: number): number {
    const score = 0.55 + realtimeCoverage * 0.4 - delayRisk * 0.2;
    return Math.max(0, Math.min(1, Number(score.toFixed(3))));
  }

  private computeRouteScore(
    adjustedTravelMinutes: number,
    transferCount: number,
    walkingMinutes: number,
    delayRisk: number,
    realtimeCoverage: number,
  ): number {
    const raw =
      100 -
      adjustedTravelMinutes * 0.8 -
      transferCount * 6 -
      walkingMinutes * 0.4 -
      delayRisk * 22 +
      realtimeCoverage * 8;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private getTransferBufferMinutes(): number {
    const raw = Number(this.appConfigService.recommendationTransferBufferMinutes ?? 4);
    if (!Number.isFinite(raw)) {
      return 4;
    }
    return Math.min(10, Math.max(3, Math.round(raw)));
  }
}
