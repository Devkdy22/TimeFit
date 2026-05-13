import { Injectable } from '@nestjs/common';
import { RouteNameMatcher } from '../matchers/route-name.matcher';
import { StationMatcher } from '../matchers/station.matcher';
import { RealtimeBusLogger } from '../logs/realtime-bus.logger';
import { CandidateScorer } from '../scoring/candidate.scorer';
import type {
  BusProvider,
  BusProviderCandidate,
  BusSegmentInput,
  RealtimeBusReasonCode,
  ResolverResult,
  RouteCandidate,
  StationCandidate,
} from '../realtime-bus.types';

@Injectable()
export class BusIdentityResolver {
  constructor(
    private readonly scorer: CandidateScorer,
    private readonly routeNameMatcher: RouteNameMatcher,
    private readonly stationMatcher: StationMatcher,
    private readonly logger: RealtimeBusLogger,
  ) {}

  async resolve(segment: BusSegmentInput, providers: BusProvider[]): Promise<ResolverResult> {
    const normalizedLineLabel = this.routeNameMatcher.normalize(segment.lineLabel);
    const normalizedStationName = this.stationMatcher.normalize(segment.startName);
    this.logger.logResolverInput({
      lineLabel: segment.lineLabel ?? null,
      startArsId: segment.startArsId ?? null,
      startStationId: segment.startStationId ?? null,
      startName: segment.startName ?? null,
      lat: segment.startLat ?? null,
      lng: segment.startLng ?? null,
      normalizedLineLabel,
      normalizedStationName,
    });

    const diagnostics = {
      providerStationCounts: { SEOUL: 0, GYEONGGI: 0, INCHEON: 0 } as Record<
        'SEOUL' | 'GYEONGGI' | 'INCHEON',
        number
      >,
      providerRouteCounts: { SEOUL: 0, GYEONGGI: 0, INCHEON: 0 } as Record<
        'SEOUL' | 'GYEONGGI' | 'INCHEON',
        number
      >,
      failedProviders: [] as Array<{ provider: 'SEOUL' | 'GYEONGGI' | 'INCHEON'; reason: RealtimeBusReasonCode }>,
    };

    const stationCandidates: StationCandidate[] = [];
    const routeCandidates: Array<{ station: StationCandidate; route: RouteCandidate }> = [];
    const providerCandidates: BusProviderCandidate[] = [];
    const context = { segment };

    for (const provider of providers) {
      try {
        const stations = await provider.findStationCandidates(context);
        diagnostics.providerStationCounts[provider.type] = stations.length;
        stationCandidates.push(...stations);
        this.logger.logProviderStage({
          provider: provider.type,
          stationCandidateCount: stations.length,
        });

        if (stations.length === 0) {
          const syntheticCandidate = this.buildSyntheticProviderCandidate(provider.type, segment);
          if (syntheticCandidate) {
            providerCandidates.push(syntheticCandidate);
            routeCandidates.push({
              station: syntheticCandidate.station,
              route: syntheticCandidate.route,
            });
            diagnostics.providerRouteCounts[provider.type] += 1;
            this.logger.logProviderStage({
              provider: provider.type,
              stationCandidateCount: 0,
              syntheticCandidateUsed: true,
              syntheticStationId: syntheticCandidate.station.stationId,
              syntheticRouteName: syntheticCandidate.route.routeName,
            });
            this.logger.logCandidate(provider.type, syntheticCandidate.score, {
              arsMatch: syntheticCandidate.scoreBreakdown?.arsMatch ?? 0,
              lineMatch: syntheticCandidate.scoreBreakdown?.lineMatch ?? 0,
              distanceScore: syntheticCandidate.scoreBreakdown?.distanceScore ?? 0,
              stationNameScore: syntheticCandidate.scoreBreakdown?.stationNameScore ?? 0,
              providerPriority: syntheticCandidate.scoreBreakdown?.providerPriority ?? 0,
              penalty: syntheticCandidate.scoreBreakdown?.penalty ?? 0,
            });
            continue;
          }

          const reason: RealtimeBusReasonCode = segment.startArsId
            ? 'ARS_LOOKUP_EMPTY'
            : 'PROVIDER_ID_MAPPING_FAILED';
          diagnostics.failedProviders.push({ provider: provider.type, reason });
          this.logger.logReject(provider.type, reason);
          continue;
        }

        let providerRouteCount = 0;
        for (const station of stations) {
          const routes = await provider.findRouteCandidates(station, context);
          const matchedRoutes = routes.filter((route) =>
            this.routeNameMatcher.isMatch(segment.lineLabel, route.routeName),
          );

          providerRouteCount += matchedRoutes.length;
          diagnostics.providerRouteCounts[provider.type] += matchedRoutes.length;
          this.logger.logProviderStage({
            provider: provider.type,
            stationId: station.stationId,
            stationName: station.stationName,
            routeCandidateCount: routes.length,
            routeMatchedCount: matchedRoutes.length,
          });

          for (const route of matchedRoutes) {
            routeCandidates.push({ station, route });
            const breakdown = this.scorer.score(
              {
                provider: provider.type,
                station,
                route,
              },
              segment,
            );
            providerCandidates.push({
              provider: provider.type,
              station,
              route,
              score: breakdown.total,
              scoreBreakdown: {
                arsMatch: breakdown.arsMatch,
                lineMatch: breakdown.lineMatch,
                distanceScore: breakdown.distanceScore,
                stationNameScore: breakdown.stationNameScore,
                providerPriority: breakdown.providerPriority,
                penalty: breakdown.penalty,
              },
            });
            this.logger.logCandidate(provider.type, breakdown.total, {
              arsMatch: breakdown.arsMatch,
              lineMatch: breakdown.lineMatch,
              distanceScore: breakdown.distanceScore,
              stationNameScore: breakdown.stationNameScore,
              providerPriority: breakdown.providerPriority,
              penalty: breakdown.penalty,
            });
          }
        }

        if (providerRouteCount === 0) {
          diagnostics.failedProviders.push({
            provider: provider.type,
            reason: 'STATION_FOUND_ROUTE_NOT_FOUND',
          });
          this.logger.logReject(provider.type, 'STATION_FOUND_ROUTE_NOT_FOUND');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const reason: RealtimeBusReasonCode = message.includes('timeout')
          ? 'PROVIDER_API_TIMEOUT'
          : 'PROVIDER_ID_MAPPING_FAILED';
        diagnostics.failedProviders.push({ provider: provider.type, reason });
        this.logger.logReject(provider.type, reason, error instanceof Error ? error.message : String(error));
      }
    }

    providerCandidates.sort((a, b) => b.score - a.score);
    return {
      stationCandidates,
      routeCandidates,
      providerCandidates,
      diagnostics,
    };
  }

  private buildSyntheticProviderCandidate(
    provider: 'SEOUL' | 'GYEONGGI' | 'INCHEON',
    segment: BusSegmentInput,
  ): BusProviderCandidate | null {
    // 서울은 ARS + 노선번호(lineLabel) 조합으로 도착정보를 직접 조회할 수 있다.
    // 검색 응답이 비어도 이 synthetic 후보로 실시간 조회를 시도한다.
    if (provider !== 'SEOUL') {
      return null;
    }

    const arsId = (segment.startArsId ?? '').replace(/[^0-9]/g, '');
    const lineLabel = (segment.lineLabel ?? '').trim();
    if (!arsId || !lineLabel) {
      return null;
    }

    const station: StationCandidate = {
      provider: 'SEOUL',
      stationId: arsId,
      stationName: segment.startName?.trim() || arsId,
      arsId,
      lat: segment.startLat,
      lng: segment.startLng,
    };
    const route: RouteCandidate = {
      provider: 'SEOUL',
      // Prefer ODsay route id when available; fallback to line label.
      routeId: (segment.busRouteId ?? '').trim() || lineLabel,
      routeName: lineLabel,
      direction: undefined,
    };
    const breakdown = this.scorer.score(
      {
        provider: 'SEOUL',
        station,
        route,
      },
      segment,
    );
    return {
      provider: 'SEOUL',
      station,
      route,
      score: breakdown.total,
      scoreBreakdown: {
        arsMatch: breakdown.arsMatch,
        lineMatch: breakdown.lineMatch,
        distanceScore: breakdown.distanceScore,
        stationNameScore: breakdown.stationNameScore,
        providerPriority: breakdown.providerPriority,
        penalty: breakdown.penalty,
      },
    };
  }
}
