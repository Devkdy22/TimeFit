import { Injectable } from '@nestjs/common';
import { MemoryTtlCacheService } from '../../../common/cache/memory-ttl-cache.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import { calculateRouteScore } from '../../../domain/recommendation/route-score.calculator';
import { selectRecommendation } from '../../../domain/recommendation/route-selection.policy';
import { TrafficSnapshotRepository } from '../cache/traffic-snapshot.repository';
import { KakaoMapClient } from '../integrations/kakao-map.client';
import { SeoulBusClient } from '../integrations/seoul-bus.client';
import { SeoulSubwayClient } from '../integrations/seoul-subway.client';
import { TrafficClient } from '../integrations/traffic.client';
import { WeatherClient } from '../integrations/weather.client';
import { RecommendationRequestDto } from '../dto/recommendation-request.dto';
import {
  type RecommendationResult,
  type RecommendationSelectionContext,
  type LocationInput,
  type RouteCandidate,
  type RouteType,
  type ScoredRoute,
  type UserPreference,
} from '../types/recommendation.types';

interface RouteInputWithOptionalSource extends Omit<RouteCandidate, 'source'> {
  source?: RouteCandidate['source'];
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly logger: SafeLogger,
    private readonly memoryTtlCacheService: MemoryTtlCacheService,
    private readonly trafficSnapshotRepository: TrafficSnapshotRepository,
    private readonly kakaoMapClient: KakaoMapClient,
    private readonly seoulBusClient: SeoulBusClient,
    private readonly seoulSubwayClient: SeoulSubwayClient,
    private readonly trafficClient: TrafficClient,
    private readonly weatherClient: WeatherClient,
  ) {}

  async recommend(input: RecommendationRequestDto): Promise<RecommendationResult> {
    const arrivalAt = new Date(input.arrivalAt);

    const preference: UserPreference = {
      prepMinutes: input.userPreference?.prepMinutes ?? 8,
      preferredBufferMinutes: input.userPreference?.preferredBufferMinutes ?? 4,
      transferPenaltyWeight: input.userPreference?.transferPenaltyWeight ?? 1,
      walkingPenaltyWeight: input.userPreference?.walkingPenaltyWeight ?? 1,
    };

    const routeResult = await this.getRouteCandidatesCached(
      input.origin,
      input.destination,
      input.candidateRoutes,
    );
    const roadResult = await this.getTrafficCongestionCached(input.origin, input.destination);
    const weatherResult = await this.getWeatherSeverityCached(input.origin, input.destination);
    const routeBusDelayRisks = await this.getBusDelayRiskByRoute(input.origin, routeResult.value);
    const avgBusDelayRisk =
      routeBusDelayRisks.length > 0
        ? routeBusDelayRisks.reduce((sum, item) => sum + item.busDelayRisk, 0) / routeBusDelayRisks.length
        : 0.15;
    const subwayDelayRisk = await this.getSubwayDelayRisk(input.destination.name);
    const roadDelayRisk = this.clamp01(roadResult.value);
    const weatherDelayRisk = this.clamp01(weatherResult.value);

    const candidates = routeResult.value.map((route) => {
      const routeBusDelayRisk =
        routeBusDelayRisks.find((item) => item.routeId === route.id)?.busDelayRisk ?? avgBusDelayRisk;
      const routeType = this.resolveRouteType(route);
      const weights = this.getDelayWeightsByRouteType(routeType);
      const baseDelayRisk = this.clamp01(
        routeBusDelayRisk * weights.bus +
          subwayDelayRisk * weights.subway +
          roadDelayRisk * weights.road +
          weatherDelayRisk * weights.weather,
      );
      const routeDelayFactor = this.getRouteDelayFactor(route.transferCount, route.walkingMinutes);
      const finalDelay = this.clamp01(baseDelayRisk + routeDelayFactor);

      return {
        ...route,
        routeType,
        delayRisk: finalDelay,
      };
    });

    this.logger.log(
      {
        event: 'recommendation.delay.components',
        busDelayRisk: Number(avgBusDelayRisk.toFixed(3)),
        subwayDelayRisk,
        roadDelayRisk,
        weatherDelayRisk,
        routes: candidates.map((route) => {
          const routeBusDelayRisk =
            routeBusDelayRisks.find((item) => item.routeId === route.id)?.busDelayRisk ?? avgBusDelayRisk;
          const weights = this.getDelayWeightsByRouteType(route.routeType ?? 'mixed');
          const baseDelayRisk = this.clamp01(
            routeBusDelayRisk * weights.bus +
              subwayDelayRisk * weights.subway +
              roadDelayRisk * weights.road +
              weatherDelayRisk * weights.weather,
          );
          const routeDelayFactor = this.getRouteDelayFactor(route.transferCount, route.walkingMinutes);
          return {
            routeId: route.id,
            routeType: route.routeType,
            busDelayRisk: Number(routeBusDelayRisk.toFixed(3)),
            estimatedTravelMinutes: route.estimatedTravelMinutes,
            transferCount: route.transferCount,
            walkingMinutes: route.walkingMinutes,
            weights,
            baseDelayRisk: Number(baseDelayRisk.toFixed(4)),
            routeDelayFactor: Number(routeDelayFactor.toFixed(4)),
            finalDelayRisk: Number(route.delayRisk.toFixed(4)),
          };
        }),
      },
      RecommendationService.name,
    );

    const scored = candidates.map((route) => {
      const routeBusDelayRisk =
        routeBusDelayRisks.find((item) => item.routeId === route.id)?.busDelayRisk ?? avgBusDelayRisk;
      const base = calculateRouteScore({
        route,
        arrivalAt,
        preference,
      });

      return {
        ...base,
        busDelayRisk: routeBusDelayRisk,
        subwayDelayRisk,
        roadDelayRisk,
        weatherDelayRisk,
        combinedDelayRisk: route.delayRisk,
      };
    });

    const selectionContext: RecommendationSelectionContext = {
      cacheHitCount: [routeResult.cacheHit, roadResult.cacheHit, weatherResult.cacheHit].filter(Boolean)
        .length,
      cacheTotalCount: 3,
      dataFreshnessScore: (routeResult.freshness + roadResult.freshness + weatherResult.freshness) / 3,
    };

    const recommendation = this.selectWithApiPrimary(scored, selectionContext);
    this.logScoringDiagnostics(scored, recommendation);
    return recommendation;
  }

  private async getBusDelayRiskByRoute(
    origin: LocationInput,
    routes: RouteCandidate[],
  ): Promise<Array<{ routeId: string; busDelayRisk: number }>> {
    try {
      const results = await Promise.all(
        routes.map(async (route) => {
          try {
            const stationId = await this.resolveRouteStationId(origin, route);
            if (!stationId) {
              return {
                routeId: route.id,
                busDelayRisk: 0.15,
              };
            }

            const routeBusId = this.resolveRouteBusId(route);
            const arrival = await this.seoulBusClient.getArrival(stationId, routeBusId);
            const avgDelayMinutes = Number(
              (((arrival.arrivalSecs ?? [arrival.arrivalSec]).reduce((sum, sec) => sum + sec, 0) /
                Math.max(1, (arrival.arrivalSecs ?? [arrival.arrivalSec]).length)) /
                60).toFixed(2),
            );

            this.logger.log(
              {
                event: 'recommendation.delay.bus.route',
                routeId: route.id,
                stationId,
                selectedBusRoute: routeBusId ?? null,
                arrivalSecs: arrival.arrivalSecs ?? [arrival.arrivalSec],
                avgDelayMinutes,
                delayRisk: arrival.delayRisk,
                source: arrival.source,
              },
              RecommendationService.name,
            );

            return {
              routeId: route.id,
              busDelayRisk: this.clamp01(arrival.delayRisk),
            };
          } catch {
            return {
              routeId: route.id,
              busDelayRisk: 0.15,
            };
          }
        }),
      );

      return results;
    } catch {
      return routes.map((route) => ({ routeId: route.id, busDelayRisk: 0.15 }));
    }
  }

  private async resolveRouteStationId(
    origin: LocationInput,
    route: RouteCandidate,
  ): Promise<string | null> {
    if (route.busStationId?.trim()) {
      return route.busStationId.trim();
    }

    const probe = this.buildRouteProbePoint(origin, route);
    const nearestStation = await this.seoulBusClient.getNearestStation(probe.lat, probe.lng);
    if (!nearestStation) {
      return null;
    }

    return nearestStation.stationId;
  }

  private buildRouteProbePoint(
    origin: LocationInput,
    route: RouteCandidate,
  ): { lat: number; lng: number } {
    const transferOffset = route.transferCount * 0.00015;
    const walkingOffset = route.walkingMinutes * 0.00003;
    const hashOffset = ((this.hashRouteId(route.id) % 5) - 2) * 0.0001;

    return {
      lat: origin.lat + transferOffset + hashOffset,
      lng: origin.lng + walkingOffset - hashOffset,
    };
  }

  private resolveRouteBusId(route: RouteCandidate): string | undefined {
    const explicit = route.busRouteId?.trim();
    if (explicit) {
      return explicit;
    }

    const name = route.name ?? '';
    const matched = name.match(/(\d{2,5})\s*번?/);
    if (matched?.[1]) {
      return matched[1];
    }

    return undefined;
  }

  private hashRouteId(routeId: string): number {
    let hash = 0;
    for (let index = 0; index < routeId.length; index += 1) {
      hash = (hash + routeId.charCodeAt(index)) % 997;
    }
    return hash;
  }

  private async getSubwayDelayRisk(stationName: string): Promise<number> {
    if (!stationName || !stationName.trim()) {
      return 0.1;
    }

    try {
      const arrival = await this.seoulSubwayClient.getSubwayArrival(stationName);
      return this.clamp01(arrival.delayRisk);
    } catch {
      return 0.1;
    }
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private getRouteDelayFactor(transferCount: number, walkingMinutes: number): number {
    return transferCount * 0.03 + walkingMinutes * 0.002;
  }

  private resolveRouteType(route: RouteCandidate): RouteType {
    if (route.routeType) {
      return route.routeType;
    }

    const name = route.name.toLowerCase();
    const isBus = name.includes('bus') || name.includes('버스');
    const isSubway = name.includes('subway') || name.includes('지하철');
    const isCar =
      name.includes('car') ||
      name.includes('자동차') ||
      name.includes('자가용') ||
      name.includes('택시') ||
      name.includes('차량');

    if (isCar) {
      return 'car';
    }
    if (isBus && !isSubway) {
      return 'bus';
    }
    if (isSubway && !isBus) {
      return 'subway';
    }

    return 'mixed';
  }

  private getDelayWeightsByRouteType(routeType: RouteType): {
    bus: number;
    subway: number;
    road: number;
    weather: number;
  } {
    if (routeType === 'bus') {
      return { bus: 0.5, subway: 0.2, road: 0.2, weather: 0.1 };
    }
    if (routeType === 'bus-heavy') {
      return { bus: 0.5, subway: 0.2, road: 0.2, weather: 0.1 };
    }
    if (routeType === 'subway') {
      return { bus: 0.2, subway: 0.5, road: 0.2, weather: 0.1 };
    }
    if (routeType === 'subway-heavy') {
      return { bus: 0.2, subway: 0.5, road: 0.2, weather: 0.1 };
    }
    if (routeType === 'walking-heavy') {
      return { bus: 0.15, subway: 0.2, road: 0.15, weather: 0.5 };
    }
    if (routeType === 'car') {
      return { bus: 0.1, subway: 0.1, road: 0.6, weather: 0.2 };
    }

    return { bus: 0.35, subway: 0.25, road: 0.25, weather: 0.15 };
  }

  private async getRouteCandidatesCached(
    origin: LocationInput,
    destination: LocationInput,
    routes?: RouteInputWithOptionalSource[],
  ): Promise<{ value: RouteCandidate[]; cacheHit: boolean; freshness: number }> {
    if (routes && routes.length >= 3) {
      return {
        value: routes.map((route) => ({
          ...route,
          source: route.source ?? 'api',
        })),
        cacheHit: false,
        freshness: 1,
      };
    }

    const key = `route:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    const fromMemory = this.memoryTtlCacheService.get<RouteCandidate[]>(key);
    if (fromMemory) {
      return { value: fromMemory, cacheHit: true, freshness: 0.9 };
    }

    const normalized = await this.kakaoMapClient.getRouteCandidates(origin, destination);
    this.memoryTtlCacheService.set(key, normalized.candidates, normalized.cacheableForMs);
    return {
      value: normalized.candidates,
      cacheHit: false,
      freshness: normalized.source === 'api' ? 0.85 : 0.6,
    };
  }

  private async getTrafficCongestionCached(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<{ value: number; cacheHit: boolean; freshness: number }> {
    const key = `traffic:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;

    const cached = this.memoryTtlCacheService.get<{ congestionIndex: number }>(key);
    if (cached) {
      return { value: cached.congestionIndex, cacheHit: true, freshness: 0.95 };
    }

    const dbCached = await this.trafficSnapshotRepository.findValidByKey(key);
    if (dbCached) {
      this.memoryTtlCacheService.set(key, { congestionIndex: dbCached.congestionIndex }, 60_000);
      return {
        value: dbCached.congestionIndex,
        cacheHit: true,
        freshness: dbCached.freshnessScore,
      };
    }

    const normalized = await this.trafficClient.getTrafficDelay(origin, destination);
    await this.trafficSnapshotRepository.upsert({
      key,
      congestionIndex: normalized.congestionIndex,
      ttlSeconds: Math.max(60, Math.round(normalized.cacheableForMs / 1000)),
    });
    this.memoryTtlCacheService.set(
      key,
      { congestionIndex: normalized.congestionIndex },
      normalized.cacheableForMs,
    );

    return {
      value: normalized.congestionIndex,
      cacheHit: false,
      freshness: normalized.source === 'api' ? 0.85 : 0.55,
    };
  }

  private async getWeatherSeverityCached(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<{ value: number; cacheHit: boolean; freshness: number }> {
    const key = `weather:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    const cached = this.memoryTtlCacheService.get<number>(key);
    if (cached !== null) {
      return { value: cached, cacheHit: true, freshness: 0.9 };
    }

    const normalized = await this.weatherClient.getWeatherDelayFactor(origin, destination);
    this.memoryTtlCacheService.set(key, normalized.severityIndex, normalized.cacheableForMs);
    return {
      value: normalized.severityIndex,
      cacheHit: false,
      freshness: normalized.source === 'api' ? 0.85 : 0.6,
    };
  }

  private selectWithApiPrimary(
    scored: ScoredRoute[],
    context: RecommendationSelectionContext,
  ): RecommendationResult {
    const apiRoutes = scored.filter((route) => route.route.source === 'api');

    if (apiRoutes.length === 0) {
      return selectRecommendation(scored, context);
    }

    const primaryFromApi = this.sortScoredRoutes(apiRoutes)[0];
    const alternatives = this.sortScoredRoutes(
      scored.filter((route) => route.route.id !== primaryFromApi.route.id),
    ).slice(0, 3);

    const base = selectRecommendation(apiRoutes, context);

    return {
      primaryRoute: primaryFromApi,
      alternatives,
      status: primaryFromApi.status,
      nextAction: base.nextAction,
      confidenceScore: base.confidenceScore,
      generatedAt: base.generatedAt,
    };
  }

  private sortScoredRoutes(routes: ScoredRoute[]): ScoredRoute[] {
    return [...routes].sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }

      return b.bufferMinutes - a.bufferMinutes;
    });
  }

  private logScoringDiagnostics(scored: ScoredRoute[], recommendation: RecommendationResult) {
    const sorted = this.sortScoredRoutes(scored);
    const primary = recommendation.primaryRoute;
    const alternatives = recommendation.alternatives;
    const primaryScore = primary.totalScore;

    const routeComparison = sorted.map((item) => ({
      id: item.route.id,
      source: item.route.source,
      totalScore: item.totalScore,
      delayRisk: Number(item.route.delayRisk.toFixed(3)),
      estimatedTravelMinutes: item.route.estimatedTravelMinutes,
      transferCount: item.route.transferCount,
      walkingMinutes: item.route.walkingMinutes,
      bufferMinutes: item.bufferMinutes,
      punctuality: item.scoreBreakdown.punctuality,
      safety: item.scoreBreakdown.safety,
      delayPenalty: Number(item.scoreBreakdown.delayPenalty.toFixed(2)),
      bufferPenalty: Number(item.scoreBreakdown.bufferPenalty.toFixed(2)),
    }));

    const scoreDiffs = alternatives.map((item) => ({
      id: item.route.id,
      source: item.route.source,
      scoreDiffFromPrimary: primaryScore - item.totalScore,
    }));

    const topOverall = sorted[0];
    const hasApiRoute = scored.some((item) => item.route.source === 'api');

    let primaryReason = 'highest totalScore and buffer among comparable candidates';
    if (primary.route.source === 'api' && topOverall.route.id !== primary.route.id) {
      primaryReason =
        'API-primary policy applied: fallback route had higher score but API route exists';
    } else if (primary.route.source === 'api' && hasApiRoute) {
      primaryReason = 'selected by highest score within API-sourced candidates';
    } else if (primary.route.source === 'fallback') {
      primaryReason = 'no API routes were available, fallback route selected';
    }

    const fallbackCause =
      primary.route.source === 'fallback'
        ? {
            cause: 'fallback_selected',
            reason: hasApiRoute
              ? 'API routes existed but were not eligible after scoring constraints'
              : 'API route retrieval failed or returned no route candidates',
            primaryScore,
          }
        : undefined;

    const anomalies: Array<{ code: string; detail: string }> = [];
    const fasterNotSelected = sorted.filter((item) => {
      if (item.route.id === primary.route.id) {
        return false;
      }

      const minutesGap = primary.route.estimatedTravelMinutes - item.route.estimatedTravelMinutes;
      const scoreGap = primary.totalScore - item.totalScore;
      const bufferGap = primary.bufferMinutes - item.bufferMinutes;
      return minutesGap >= 3 && scoreGap <= 15 && bufferGap <= 5;
    });
    if (fasterNotSelected.length > 0) {
      anomalies.push({
        code: 'FASTER_ROUTE_NOT_SELECTED',
        detail: fasterNotSelected
          .map((item) => {
            const minutesGap = primary.route.estimatedTravelMinutes - item.route.estimatedTravelMinutes;
            const scoreGap = primary.totalScore - item.totalScore;
            return `${item.route.id}(faster=${minutesGap}m,scoreGap=${scoreGap})`;
          })
          .join(', '),
      });
    }

    const lowerDelayNotSelected = sorted.filter((item) => {
      if (item.route.id === primary.route.id) {
        return false;
      }

      const delayGap = primary.route.delayRisk - item.route.delayRisk;
      const scoreGap = primary.totalScore - item.totalScore;
      const bufferGap = primary.bufferMinutes - item.bufferMinutes;
      return delayGap >= 0.05 && scoreGap <= 15 && bufferGap <= 5;
    });
    if (lowerDelayNotSelected.length > 0) {
      anomalies.push({
        code: 'LOWER_DELAY_ROUTE_DEPRIORITIZED',
        detail: lowerDelayNotSelected
          .map((item) => {
            const delayGap = Number((primary.route.delayRisk - item.route.delayRisk).toFixed(3));
            const scoreGap = primary.totalScore - item.totalScore;
            return `${item.route.id}(delayGap=${delayGap},scoreGap=${scoreGap})`;
          })
          .join(', '),
      });
    }

    const lowWalkingCandidate = sorted.reduce((best, current) =>
      current.route.walkingMinutes < best.route.walkingMinutes ? current : best,
    );
    if (
      primary.route.walkingMinutes >= 12 &&
      lowWalkingCandidate.route.id !== primary.route.id &&
      primary.route.walkingMinutes - lowWalkingCandidate.route.walkingMinutes >= 5 &&
      primary.totalScore - lowWalkingCandidate.totalScore <= 12
    ) {
      anomalies.push({
        code: 'HIGH_WALKING_ROUTE_SELECTED',
        detail: `primary(${primary.route.id}) walking=${primary.route.walkingMinutes}min, candidate(${lowWalkingCandidate.route.id}) walking=${lowWalkingCandidate.route.walkingMinutes}min, scoreGap=${primary.totalScore - lowWalkingCandidate.totalScore}`,
      });
    }

    const minDelayRoute = sorted.reduce((best, current) =>
      current.route.delayRisk < best.route.delayRisk ? current : best,
    );
    if (
      primary.route.delayRisk >= 0.25 &&
      minDelayRoute.route.id !== primary.route.id &&
      primary.totalScore - minDelayRoute.totalScore <= 10
    ) {
      anomalies.push({
        code: 'DELAY_HIGH_BUT_SELECTED',
        detail: `primary(${primary.route.id}) delayRisk=${primary.route.delayRisk.toFixed(3)} while ${minDelayRoute.route.id} has lower delayRisk=${minDelayRoute.route.delayRisk.toFixed(3)}`,
      });
    }

    const fallbackRoutes = sorted.filter((item) => item.route.source === 'fallback');
    const bestApi = sorted.find((item) => item.route.source === 'api');
    if (bestApi) {
      for (const fallbackRoute of fallbackRoutes) {
        if (fallbackRoute.totalScore - bestApi.totalScore >= 15) {
          anomalies.push({
            code: 'FALLBACK_SCORE_ABNORMALLY_HIGH',
            detail: `${fallbackRoute.route.id} score(${fallbackRoute.totalScore}) is significantly higher than best API route(${bestApi.totalScore})`,
          });
        }
      }
    }

    this.logger.log(
      {
        event: 'recommendation.scoring.delta',
        baseScore: 100,
        scoreDeltas: sorted.map((item) => ({
          routeId: item.route.id,
          totalScore: item.totalScore,
          bonuses: {
            punctuality: item.scoreBreakdown.punctuality,
            safety: item.scoreBreakdown.safety,
          },
          penalties: {
            transfer: Number(item.scoreBreakdown.transferPenalty.toFixed(2)),
            walking: Number(item.scoreBreakdown.walkingPenalty.toFixed(2)),
            earlyArrival: Number(item.scoreBreakdown.earlyArrivalPenalty.toFixed(2)),
            delay: Number(item.scoreBreakdown.delayPenalty.toFixed(2)),
            buffer: Number(item.scoreBreakdown.bufferPenalty.toFixed(2)),
          },
        })),
      },
      RecommendationService.name,
    );

    this.logger.log(
      {
        event: 'recommendation.scoring.comparison',
        routeComparison,
        primary: {
          id: primary.route.id,
          source: primary.route.source,
          totalScore: primary.totalScore,
          reason: primaryReason,
        },
        scoreDiffs,
        fallbackCause,
        anomalies,
      },
      RecommendationService.name,
    );

    this.logger.log(
      {
        event: 'recommendation.anomalies',
        primaryRouteId: primary.route.id,
        primaryScore: primary.totalScore,
        anomalies,
        routeSnapshot: sorted.map((item) => ({
          routeId: item.route.id,
          totalScore: item.totalScore,
          estimatedTravelMinutes: item.route.estimatedTravelMinutes,
          delayRisk: Number(item.route.delayRisk.toFixed(3)),
          walkingMinutes: item.route.walkingMinutes,
          bufferMinutes: item.bufferMinutes,
        })),
      },
      RecommendationService.name,
    );
  }
}
