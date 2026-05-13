import { Injectable } from '@nestjs/common';
import { EtaCacheService } from './cache/eta-cache.service';
import { MappingCacheService } from './cache/mapping-cache.service';
import { RealtimeBusLogger } from './logs/realtime-bus.logger';
import { RouteNameMatcher } from './matchers/route-name.matcher';
import { StationMatcher } from './matchers/station.matcher';
import { GyeonggiBusProvider } from './providers/gyeonggi-bus.provider';
import { IncheonBusProvider } from './providers/incheon-bus.provider';
import { SeoulBusProvider } from './providers/seoul-bus.provider';
import { BusIdentityResolver } from './resolver/bus-identity.resolver';
import type {
  BusProvider,
  BusProviderType,
  BusSegmentInput,
  EtaCacheValue,
  RealtimeBusReasonCode,
  ResolvedRealtimeBus,
} from './realtime-bus.types';
import { SeoulBusClient } from '../recommendation/integrations/seoul-bus.client';

@Injectable()
export class RealtimeBusService {
  private readonly threshold = 60;
  private readonly inFlight = new Map<string, Promise<ResolvedRealtimeBus>>();

  constructor(
    private readonly resolver: BusIdentityResolver,
    private readonly mappingCache: MappingCacheService,
    private readonly etaCache: EtaCacheService,
    private readonly logger: RealtimeBusLogger,
    private readonly seoulBusProvider: SeoulBusProvider,
    private readonly gyeonggiBusProvider: GyeonggiBusProvider,
    private readonly incheonBusProvider: IncheonBusProvider,
    private readonly seoulBusClient: SeoulBusClient,
    private readonly routeNameMatcher: RouteNameMatcher,
    private readonly stationMatcher: StationMatcher,
  ) {}

  async resolveEta(segment: BusSegmentInput): Promise<ResolvedRealtimeBus> {
    const inFlightKey = this.toInFlightKey(segment);
    const running = this.inFlight.get(inFlightKey);
    if (running) {
      return running;
    }

    const task = this.resolveEtaInternal(segment).finally(() => {
      this.inFlight.delete(inFlightKey);
    });
    this.inFlight.set(inFlightKey, task);
    return task;
  }

  private async resolveEtaInternal(segment: BusSegmentInput): Promise<ResolvedRealtimeBus> {
    const startedAt = Date.now();
    const providerDiagnostics: Record<string, unknown> = {};
    const liveCached = this.etaCache.getLive(segment);
    if (liveCached) {
      this.logger.logCacheHit('live', {
        provider: liveCached.provider,
        status: liveCached.status,
        etaMinutes: liveCached.etaMinutes ?? null,
        etaSeconds: liveCached.etaSeconds ?? null,
        lineLabel: segment.lineLabel ?? null,
        startArsId: segment.startArsId ?? null,
        startStationId: segment.startStationId ?? null,
      });
      return this.fromCache(liveCached);
    }

    const providers = this.providersOrdered();
    const resolved = await this.resolver.resolve(segment, providers);
    const failedProviders = [...resolved.diagnostics.failedProviders];

    let lastReason: RealtimeBusReasonCode | undefined;
    const aboveThreshold = resolved.providerCandidates.filter((candidate) => candidate.score >= this.threshold);
    if (aboveThreshold.length === 0 && resolved.providerCandidates.length > 0) {
      lastReason = 'SCORE_BELOW_THRESHOLD';
      for (const candidate of resolved.providerCandidates) {
        failedProviders.push({ provider: candidate.provider, reason: 'SCORE_BELOW_THRESHOLD' });
        this.logger.logReject(candidate.provider, 'SCORE_BELOW_THRESHOLD', `score=${candidate.score}`);
      }
    }

    for (const candidate of aboveThreshold) {
      const provider = providers.find((item) => item.type === candidate.provider);
      if (!provider) {
        failedProviders.push({ provider: candidate.provider, reason: 'PROVIDER_ID_MAPPING_FAILED' });
        continue;
      }

      try {
        const arrival = await provider.getArrival({
          stationId: candidate.station.stationId,
          routeId: candidate.route.routeId,
        });

        if (!arrival?.etaMinutes) {
          if (candidate.provider === 'SEOUL') {
            const probe = await this.seoulBusClient.probeStationUid(
              candidate.station.stationId,
              candidate.route.routeId,
            );
            if (probe) {
              providerDiagnostics.SEOUL = probe;
            }
          }
          lastReason = 'ROUTE_FOUND_ARRIVAL_EMPTY';
          failedProviders.push({ provider: candidate.provider, reason: 'ROUTE_FOUND_ARRIVAL_EMPTY' });
          this.logger.logReject(candidate.provider, 'ROUTE_FOUND_ARRIVAL_EMPTY');
          continue;
        }

        const result: ResolvedRealtimeBus = {
          status: arrival.etaMinutes >= 8 ? 'DELAYED' : 'LIVE',
          etaMinutes: arrival.etaMinutes,
          etaSeconds: arrival.etaSeconds,
          provider: candidate.provider,
          confidence: Math.min(100, candidate.score),
          updatedAt: arrival.updatedAt,
          ...(this.buildDebug(segment, {
            selectedProvider: candidate.provider,
            selectedScore: candidate.score,
            failedProviders,
            reasonCode: undefined,
            candidateCount: resolved.providerCandidates.length,
            providerDiagnostics,
          }) ?? {}),
        };

        this.mappingCache.set(segment, {
          provider: candidate.provider,
          providerStationId: candidate.station.stationId,
          providerRouteId: candidate.route.routeId,
          confidence: Math.min(100, candidate.score),
          routeName: candidate.route.routeName,
        });
        this.etaCache.set(segment, { ...result, provider: candidate.provider });

        this.logger.logSelected(candidate.provider);
        this.logger.logEta(result.status, result.etaMinutes);
        return result;
      } catch (error) {
        const reason: RealtimeBusReasonCode = this.isTimeout(error)
          ? 'PROVIDER_API_TIMEOUT'
          : 'PROVIDER_ID_MAPPING_FAILED';
        lastReason = reason;
        failedProviders.push({ provider: candidate.provider, reason });
        this.logger.logReject(
          candidate.provider,
          reason,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const mappingCached = this.mappingCache.get(segment);
    if (mappingCached) {
      this.logger.logCacheHit('mapping', {
        provider: mappingCached.provider,
        providerStationId: mappingCached.providerStationId,
        providerRouteId: mappingCached.providerRouteId,
        confidence: mappingCached.confidence,
        lineLabel: segment.lineLabel ?? null,
      });
      const provider = providers.find((item) => item.type === mappingCached.provider);
      if (provider) {
        try {
          const arrival = await provider.getArrival({
            stationId: mappingCached.providerStationId,
            routeId: mappingCached.providerRouteId,
          });
          if (arrival?.etaMinutes) {
            const result: ResolvedRealtimeBus = {
              status: arrival.etaMinutes >= 8 ? 'DELAYED' : 'LIVE',
              etaMinutes: arrival.etaMinutes,
              etaSeconds: arrival.etaSeconds,
              provider: mappingCached.provider,
              confidence: mappingCached.confidence,
              updatedAt: arrival.updatedAt,
              ...(this.buildDebug(segment, {
                selectedProvider: mappingCached.provider,
                selectedScore: mappingCached.confidence,
                failedProviders,
                reasonCode: undefined,
                candidateCount: resolved.providerCandidates.length,
                providerDiagnostics,
              }) ?? {}),
            };
            this.etaCache.set(segment, { ...result, provider: mappingCached.provider });
            this.logger.logSelected(mappingCached.provider);
            this.logger.logEta(result.status, result.etaMinutes);
            return result;
          }
        } catch (error) {
          failedProviders.push({
            provider: mappingCached.provider,
            reason: this.isTimeout(error) ? 'PROVIDER_API_TIMEOUT' : 'PROVIDER_ID_MAPPING_FAILED',
          });
        }
      }
    }

    const direct = await this.tryDirectSeoulArsFallback(segment, failedProviders, resolved.providerCandidates.length);
    if (direct) {
      return direct;
    }

    const stale = this.etaCache.getStale(segment);
    if (stale) {
      this.logger.logCacheHit('stale', {
        provider: stale.provider,
        status: stale.status,
        etaMinutes: stale.etaMinutes ?? null,
        etaSeconds: stale.etaSeconds ?? null,
        lineLabel: segment.lineLabel ?? null,
        startArsId: segment.startArsId ?? null,
      });
      this.logger.logEta('STALE', stale.etaMinutes);
      return {
        status: 'STALE',
        etaMinutes: stale.etaMinutes,
        etaSeconds: stale.etaSeconds,
        provider: stale.provider,
        confidence: stale.confidence,
        updatedAt: stale.updatedAt,
        reasonCode: 'CACHE_STALE_USED',
        ...(this.buildDebug(segment, {
          selectedProvider: stale.provider,
          selectedScore: stale.confidence,
          failedProviders,
          reasonCode: 'CACHE_STALE_USED',
          candidateCount: resolved.providerCandidates.length,
          providerDiagnostics,
        }) ?? {}),
      };
    }

    const finalReason = lastReason ?? (failedProviders.length > 0 ? 'ALL_PROVIDER_FAILED' : 'NO_PROVIDER_MATCH');
    this.logger.logFail(finalReason, Date.now() - startedAt);
    this.logger.logFinalUnavailable({
      reason: finalReason,
      elapsedMs: Date.now() - startedAt,
      failedProviders,
      candidateCount: resolved.providerCandidates.length,
      lineLabel: segment.lineLabel,
      startArsId: segment.startArsId,
      startStationId: segment.startStationId,
    });
    return {
      status: 'UNAVAILABLE',
      confidence: 0,
      updatedAt: new Date().toISOString(),
      reasonCode: finalReason,
      ...(this.buildDebug(segment, {
        failedProviders,
        reasonCode: finalReason,
        candidateCount: resolved.providerCandidates.length,
        providerDiagnostics,
      }) ?? {}),
    };
  }

  private providersOrdered(): BusProvider[] {
    return [this.seoulBusProvider, this.gyeonggiBusProvider, this.incheonBusProvider].sort(
      (a, b) => b.priority - a.priority,
    );
  }

  private fromCache(cache: EtaCacheValue): ResolvedRealtimeBus {
    return {
      status: cache.status,
      etaMinutes: cache.etaMinutes,
      etaSeconds: cache.etaSeconds,
      provider: cache.provider,
      confidence: cache.confidence,
      updatedAt: cache.updatedAt,
      reasonCode: cache.reasonCode,
    };
  }

  private toInFlightKey(segment: BusSegmentInput): string {
    return `${segment.lineLabel ?? ''}:${segment.startArsId ?? ''}:${segment.startStationId ?? ''}`;
  }

  private async tryDirectSeoulArsFallback(
    segment: BusSegmentInput,
    failedProviders: Array<{ provider: BusProviderType; reason: RealtimeBusReasonCode }>,
    candidateCount: number,
  ): Promise<ResolvedRealtimeBus | null> {
    const arsId = (segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const routeNo = (segment.lineLabel ?? '').trim();
    if (!arsId || !routeNo) {
      return null;
    }

    const arrival = await this.seoulBusClient.getArrivalByArsId(arsId, routeNo);
    const relaxedArrival = arrival ?? (await this.seoulBusClient.getArrivalByArsId(arsId));
    if (!relaxedArrival) {
      return null;
    }

    const isRelaxed = !arrival;
    if (isRelaxed) {
      failedProviders.push({ provider: 'SEOUL', reason: 'ROUTE_MISMATCH' });
      this.logger.logReject('SEOUL', 'ROUTE_MISMATCH', `ars=${arsId} line=${routeNo}`);
    }

    const etaMinutes = Math.max(1, Math.round(relaxedArrival.arrivalSec / 60));
    const result: ResolvedRealtimeBus = {
      status: etaMinutes >= 8 ? 'DELAYED' : 'LIVE',
      etaMinutes,
      etaSeconds: Math.max(10, Math.round(relaxedArrival.arrivalSec)),
      provider: 'SEOUL',
      confidence: isRelaxed ? 55 : 75,
      updatedAt: new Date().toISOString(),
      reasonCode: isRelaxed ? 'ROUTE_MISMATCH' : undefined,
      ...(this.buildDebug(segment, {
        selectedProvider: 'SEOUL',
        selectedScore: isRelaxed ? 55 : 75,
        failedProviders,
        reasonCode: isRelaxed ? 'ROUTE_MISMATCH' : undefined,
        candidateCount,
      }) ?? {}),
    };

    this.mappingCache.set(segment, {
      provider: 'SEOUL',
      providerStationId: arsId,
      providerRouteId: routeNo,
      confidence: result.confidence,
      routeName: routeNo,
    });
    this.etaCache.set(segment, { ...result, provider: 'SEOUL' });
    this.logger.logSelected('SEOUL');
    this.logger.logEta(result.status, result.etaMinutes);
    return result;
  }

  private buildDebug(
    segment: BusSegmentInput,
    payload: {
      selectedProvider?: BusProviderType;
      selectedScore?: number;
      failedProviders: Array<{ provider: BusProviderType; reason: RealtimeBusReasonCode }>;
      reasonCode?: RealtimeBusReasonCode;
      candidateCount: number;
      providerDiagnostics?: Record<string, unknown>;
    },
  ): Pick<ResolvedRealtimeBus, 'debug'> | null {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    return {
      debug: {
        selectedProvider: payload.selectedProvider,
        selectedScore: payload.selectedScore,
        failedProviders: payload.failedProviders,
        reasonCode: payload.reasonCode,
        candidateCount: payload.candidateCount,
        normalizedLineLabel: this.routeNameMatcher.normalize(segment.lineLabel),
        normalizedStationName: this.stationMatcher.normalize(segment.startName),
        providerDiagnostics: payload.providerDiagnostics,
      },
    };
  }

  private isTimeout(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.toLowerCase().includes('timeout');
  }
}
