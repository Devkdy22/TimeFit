import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { BusProviderType, RealtimeBusReasonCode, RealtimeBusStatus } from '../realtime-bus.types';

@Injectable()
export class RealtimeBusLogger {
  constructor(private readonly logger: SafeLogger) {}

  logResolverInput(payload: Record<string, unknown>): void {
    this.logger.log({ event: 'bus_resolver.input', ...payload }, RealtimeBusLogger.name);
  }

  logProviderStage(payload: Record<string, unknown>): void {
    this.logger.log({ event: 'bus_resolver.provider', ...payload }, RealtimeBusLogger.name);
  }

  logCandidate(
    provider: BusProviderType,
    score: number,
    breakdown?: {
      arsMatch: number;
      lineMatch: number;
      distanceScore: number;
      stationNameScore: number;
      providerPriority: number;
      penalty: number;
    },
  ): void {
    this.logger.log(
      {
        event: 'bus_resolver.candidate',
        provider,
        score,
        breakdown: breakdown ?? null,
      },
      RealtimeBusLogger.name,
    );
  }

  logReject(provider: BusProviderType, reason: RealtimeBusReasonCode, detail?: string): void {
    this.logger.warn(
      {
        event: 'bus_resolver.reject',
        provider,
        reason,
        detail: detail ?? null,
      },
      RealtimeBusLogger.name,
    );
  }

  logSelected(provider: BusProviderType): void {
    this.logger.log(`[BusResolver] selected ${provider}`, RealtimeBusLogger.name);
  }

  logEta(status: RealtimeBusStatus, etaMinutes?: number): void {
    const suffix = typeof etaMinutes === 'number' ? ` ${etaMinutes}m` : '';
    this.logger.log(`[BusETA] ${status}${suffix}`, RealtimeBusLogger.name);
  }

  logFail(reason: RealtimeBusReasonCode, ms: number): void {
    this.logger.warn(`[BusETA] FAIL ${reason} ${ms}ms`, RealtimeBusLogger.name);
  }

  logCacheHit(kind: 'live' | 'stale' | 'mapping', payload: Record<string, unknown>): void {
    this.logger.log(
      {
        event: 'bus_resolver.cache_hit',
        kind,
        ...payload,
      },
      RealtimeBusLogger.name,
    );
  }

  logFinalUnavailable(payload: {
    reason: RealtimeBusReasonCode;
    elapsedMs: number;
    failedProviders: Array<{ provider: BusProviderType; reason: RealtimeBusReasonCode }>;
    candidateCount: number;
    lineLabel?: string;
    startArsId?: string;
    startStationId?: string;
  }): void {
    this.logger.warn(
      {
        event: 'bus_resolver.final_unavailable',
        ...payload,
      },
      RealtimeBusLogger.name,
    );
  }
}
