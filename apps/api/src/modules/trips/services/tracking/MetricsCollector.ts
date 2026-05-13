import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../../common/logger/safe-logger.service';
import { EventBus } from '../../../../core/EventBus';
import type { MobilityRoute } from '../../../recommendation/types/recommendation.types';

interface MetricState {
  rerouteCount: number;
  etaErrorTotal: number;
  etaErrorCount: number;
  offRouteCount: number;
  movementChecks: number;
}

@Injectable()
export class MetricsCollector {
  private readonly stateByRouteId = new Map<string, MetricState>();

  constructor(
    private readonly logger: SafeLogger,
    private readonly eventBus: EventBus,
  ) {}

  track(
    route: MobilityRoute,
    input?: {
      rerouted?: boolean;
      etaErrorMinutes?: number;
      offRoute?: boolean;
    },
  ): void {
    const current = this.stateByRouteId.get(route.id) ?? {
      rerouteCount: 0,
      etaErrorTotal: 0,
      etaErrorCount: 0,
      offRouteCount: 0,
      movementChecks: 0,
    };

    if (input?.rerouted) {
      current.rerouteCount += 1;
    }

    if (typeof input?.etaErrorMinutes === 'number') {
      current.etaErrorTotal += Math.abs(input.etaErrorMinutes);
      current.etaErrorCount += 1;
    }

    if (typeof input?.offRoute === 'boolean') {
      current.movementChecks += 1;
      if (input.offRoute) {
        current.offRouteCount += 1;
      }
    }

    this.stateByRouteId.set(route.id, current);

    const avgEtaErrorMinutes =
      current.etaErrorCount > 0 ? Number((current.etaErrorTotal / current.etaErrorCount).toFixed(2)) : 0;
    const offRouteRate =
      current.movementChecks > 0 ? Number((current.offRouteCount / current.movementChecks).toFixed(3)) : 0;

    const payload = {
      routeId: route.id,
      delayRisk: Number(route.delayRisk.toFixed(3)),
      score: Number((route.score ?? 0).toFixed(2)),
      rerouteCount: current.rerouteCount,
      realtimeCoverage: Number((route.realtimeCoverage ?? 0).toFixed(3)),
      offRouteRate,
      avgEtaErrorMinutes,
    };

    this.logger.log(
      {
        type: 'METRIC',
        ...payload,
      },
      MetricsCollector.name,
    );

    this.eventBus.emit('METRIC', payload);
  }

  reset(routeId: string): void {
    this.stateByRouteId.delete(routeId);
  }
}
