import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../common/config/app-config.service';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { LocationInput, RouteCandidate } from '../types/recommendation.types';
import type { NormalizedRouteDto } from '../dto/integration/normalized-route.dto';
import { fetchJsonWithTimeout } from '../utils/http-client.util';

interface KakaoDirectionsResponse {
  routes?: Array<{
    summary?: {
      duration?: number;
      distance?: number;
    };
    sections?: Array<{
      distance?: number;
      duration?: number;
      guides?: Array<{
        name?: string;
        guidance?: string;
        type?: number | string;
      }>;
      roads?: Array<unknown>;
    }>;
  }>;
}

@Injectable()
export class KakaoMapClient {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  async getRouteCandidates(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<NormalizedRouteDto> {
    try {
      const query = new URLSearchParams({
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        alternatives: 'true',
      });

      const url = `https://apis-navi.kakaomobility.com/v1/directions?${query.toString()}`;

      const data = await fetchJsonWithTimeout<KakaoDirectionsResponse>(
        url,
        {
          method: 'GET',
          headers: {
            Authorization: `KakaoAK ${this.appConfigService.kakaoApiKey}`,
          },
        },
        3500,
      );

      const normalized = this.normalizeRoutes(data);
      if (normalized.length > 0) {
        return {
          source: 'api',
          fetchedAt: new Date().toISOString(),
          cacheableForMs: 60_000,
          candidates: normalized.slice(0, 3),
        };
      }

      return this.buildFallback(origin, destination);
    } catch {
      return this.buildFallback(origin, destination);
    }
  }

  private normalizeRoutes(response: KakaoDirectionsResponse): RouteCandidate[] {
    const routes = response.routes ?? [];

    const converted = routes
      .map((route, index) => {
        const durationSec = route.summary?.duration ?? 0;
        const distanceM = route.summary?.distance ?? 0;
        const sections = route.sections ?? [];

        if (durationSec <= 0) {
          return null;
        }

        const transferCount = Math.max(0, sections.length - 1);
        const walkingMinutes = Math.max(1, Math.round((distanceM / 80) * 0.08));
        const estimatedTravelMinutes = Math.max(3, Math.round(durationSec / 60));
        const classification = this.classifyRouteType(route, estimatedTravelMinutes, walkingMinutes);

        const candidate: RouteCandidate = {
          id: `kakao-${index + 1}`,
          name: `Kakao 경로 ${index + 1}`,
          source: 'api',
          routeType: classification.routeType,
          estimatedTravelMinutes,
          delayRisk: 0.18 + transferCount * 0.05,
          transferCount,
          walkingMinutes,
        };

        this.logger.log(
          {
            event: 'kakao.route.type.classified',
            routeId: candidate.id,
            routeType: candidate.routeType,
            reason: classification.reason,
          },
          KakaoMapClient.name,
        );

        return candidate;
      })
      .filter((route): route is RouteCandidate => route !== null);

    if (converted.length >= 3) {
      return converted.slice(0, 3);
    }

    const base = converted[0];
    if (!base) {
      return [];
    }

    const synthesized: RouteCandidate[] = [...converted];
    while (synthesized.length < 3) {
      const variantIndex = synthesized.length + 1;
      const offset = variantIndex * 4;
      synthesized.push({
        id: `kakao-synth-${variantIndex}`,
        name: `Kakao 대체 경로 ${variantIndex}`,
        source: 'api',
        routeType: base.routeType ?? 'mixed',
        estimatedTravelMinutes: base.estimatedTravelMinutes + offset,
        delayRisk: Math.min(0.9, base.delayRisk + variantIndex * 0.04),
        transferCount: Math.max(0, base.transferCount + (variantIndex % 2)),
        walkingMinutes: Math.max(1, base.walkingMinutes + variantIndex),
      });
    }

    return synthesized.slice(0, 3);
  }

  private buildFallback(origin: LocationInput, destination: LocationInput): NormalizedRouteDto {
    const baseMinutes = this.estimateMinutesByDistance(origin, destination);

    return {
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
      cacheableForMs: 45_000,
      candidates: [
        {
          id: 'fallback-1',
          name: '기본 환승 경로',
          source: 'fallback',
          routeType: 'mixed',
          estimatedTravelMinutes: baseMinutes,
          delayRisk: 0.24,
          transferCount: 1,
          walkingMinutes: 8,
        },
        {
          id: 'fallback-2',
          name: '직행 우선 경로',
          source: 'fallback',
          routeType: 'mixed',
          estimatedTravelMinutes: baseMinutes + 6,
          delayRisk: 0.18,
          transferCount: 0,
          walkingMinutes: 6,
        },
        {
          id: 'fallback-3',
          name: '최단 시간 경로',
          source: 'fallback',
          routeType: 'mixed',
          estimatedTravelMinutes: Math.max(5, baseMinutes - 4),
          delayRisk: 0.31,
          transferCount: 2,
          walkingMinutes: 11,
        },
      ],
    };
  }

  private estimateMinutesByDistance(origin: LocationInput, destination: LocationInput): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(destination.lat - origin.lat);
    const dLng = toRad(destination.lng - origin.lng);

    const lat1 = toRad(origin.lat);
    const lat2 = toRad(destination.lat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = earthRadiusKm * c;

    const avgSpeedKmPerHour = 25;
    return Math.max(8, Math.round((distanceKm / avgSpeedKmPerHour) * 60));
  }

  private classifyRouteType(
    route: NonNullable<KakaoDirectionsResponse['routes']>[number],
    estimatedTravelMinutes: number,
    walkingMinutes: number,
  ): { routeType: RouteCandidate['routeType']; reason: string } {
    const sections = route.sections ?? [];
    const totalDurationSec =
      route.summary?.duration ??
      sections.reduce((sum, section) => sum + (section.duration ?? 0), 0) ??
      estimatedTravelMinutes * 60;

    if (totalDurationSec <= 0) {
      return { routeType: 'mixed', reason: 'insufficient_duration_data' };
    }

    const subwayDurationSec = sections.reduce((sum, section) => {
      const text = this.extractSectionText(section).toLowerCase();
      return sum + (this.hasAnyKeyword(text, ['지하철', 'subway', '호선']) ? section.duration ?? 0 : 0);
    }, 0);

    const busDurationSec = sections.reduce((sum, section) => {
      const text = this.extractSectionText(section).toLowerCase();
      return (
        sum +
        (this.hasAnyKeyword(text, ['버스', 'bus', '간선', '지선', '광역']) ? section.duration ?? 0 : 0)
      );
    }, 0);

    const walkingDurationSec = sections.reduce((sum, section) => {
      const text = this.extractSectionText(section).toLowerCase();
      return sum + (this.hasAnyKeyword(text, ['도보', 'walk', '보행']) ? section.duration ?? 0 : 0);
    }, 0);

    const subwayRatio = subwayDurationSec / totalDurationSec;
    const busRatio = busDurationSec / totalDurationSec;
    const walkingRatio = Math.max(walkingDurationSec / totalDurationSec, walkingMinutes / estimatedTravelMinutes);

    if (subwayRatio > 0.6) {
      return {
        routeType: 'subway-heavy',
        reason: `subway_ratio=${subwayRatio.toFixed(2)} > 0.60`,
      };
    }

    if (busRatio > 0.6) {
      return {
        routeType: 'bus-heavy',
        reason: `bus_ratio=${busRatio.toFixed(2)} > 0.60`,
      };
    }

    if (walkingRatio > 0.4) {
      return {
        routeType: 'walking-heavy',
        reason: `walking_ratio=${walkingRatio.toFixed(2)} > 0.40`,
      };
    }

    return {
      routeType: 'mixed',
      reason: `subway=${subwayRatio.toFixed(2)}, bus=${busRatio.toFixed(2)}, walking=${walkingRatio.toFixed(2)}`,
    };
  }

  private extractSectionText(
    section: NonNullable<NonNullable<KakaoDirectionsResponse['routes']>[number]['sections']>[number],
  ): string {
    const guides = section.guides ?? [];
    const guideText = guides
      .map((guide) => `${guide.name ?? ''} ${guide.guidance ?? ''} ${guide.type ?? ''}`.trim())
      .join(' ');
    const roads = (section.roads ?? [])
      .map((road) => String(road))
      .join(' ');
    return `${guideText} ${roads}`.trim();
  }

  private hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }
}
