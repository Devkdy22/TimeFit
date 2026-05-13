import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { NormalizedRouteDto } from '../dto/integration/normalized-route.dto';
import type { LocationInput } from '../types/recommendation.types';
import { mapResponseToRoutes } from '../adapters/odsayRouteAdapter';
import { OdsayTransitClient } from '../services/transit/OdsayTransitClient';
import { TransitRealtimeOrchestrator } from '../services/transit/TransitRealtimeOrchestrator';

@Injectable()
export class KakaoMapClient {
  constructor(
    private readonly logger: SafeLogger,
    private readonly odsayTransitClient: OdsayTransitClient,
    private readonly transitRealtimeOrchestrator: TransitRealtimeOrchestrator,
  ) {}

  async getRouteCandidates(
    origin: LocationInput,
    destination: LocationInput,
  ): Promise<NormalizedRouteDto> {
    if (!this.isCoordinateValid(origin.lat, origin.lng) || !this.isCoordinateValid(destination.lat, destination.lng)) {
      return {
        source: 'fallback',
        status: 'INVALID_INPUT',
        fetchedAt: new Date().toISOString(),
        cacheableForMs: 0,
        candidates: [],
        emptyState: {
          code: 'ROUTE_INVALID_INPUT',
          title: '출발지 또는 도착지 좌표가 올바르지 않습니다',
          description: '출발지와 도착지 위치를 다시 확인해 주세요.',
          retryable: false,
        },
      };
    }

    const odsay = await this.odsayTransitClient.fetchTransitRoutes(origin, destination);

    if (odsay.status === 'PROVIDER_TIMEOUT') {
      return {
        source: 'fallback',
        status: 'PROVIDER_TIMEOUT',
        fetchedAt: odsay.fetchedAt,
        cacheableForMs: odsay.cacheableForMs,
        candidates: [],
        providerErrorCode: 'ROUTE_PROVIDER_TIMEOUT',
      };
    }

    if (odsay.status === 'PROVIDER_DOWN') {
      return {
        source: 'fallback',
        status: 'PROVIDER_DOWN',
        fetchedAt: odsay.fetchedAt,
        cacheableForMs: odsay.cacheableForMs,
        candidates: [],
        providerErrorCode: 'ROUTE_PROVIDER_DOWN',
      };
    }

    if (odsay.status === 'INVALID_INPUT') {
      return {
        source: 'fallback',
        status: 'INVALID_INPUT',
        fetchedAt: odsay.fetchedAt,
        cacheableForMs: odsay.cacheableForMs,
        candidates: [],
        emptyState: {
          code: 'ROUTE_INVALID_INPUT',
          title: '경로 검색 조건이 올바르지 않습니다',
          description: '출발지/도착지 입력을 확인해 주세요.',
          retryable: false,
        },
      };
    }

    if (odsay.status === 'NO_RESULT') {
      return {
        source: 'api',
        status: 'NO_RESULT',
        fetchedAt: odsay.fetchedAt,
        cacheableForMs: odsay.cacheableForMs,
        candidates: [],
        emptyState: {
          code: 'ROUTE_NO_RESULT',
          title: '추천 가능한 경로가 없습니다',
          description: '출발지와 도착지를 다시 확인하거나 도착 시간을 조정해 주세요.',
          retryable: true,
        },
      };
    }

    const mapping = mapResponseToRoutes(odsay.paths, origin, destination, this.logger);

    if (mapping.routes.length === 0) {
      this.logger.warn(
        {
          event: 'kakao.route.empty',
          reason: 'odsay_response_without_valid_routes',
          origin,
          destination,
          diagnostics: mapping.diagnostics,
        },
        KakaoMapClient.name,
      );

      return {
        source: 'fallback',
        status: 'MAPPING_FAILED',
        fetchedAt: odsay.fetchedAt,
        cacheableForMs: odsay.cacheableForMs,
        candidates: [],
        diagnostics: mapping.diagnostics,
        emptyState: {
          code: 'ROUTE_EMPTY_AFTER_MAPPING',
          title: '추천 가능한 경로가 없습니다',
          description: '경로를 해석할 수 없어 다시 시도해 주세요.',
          retryable: true,
        },
      };
    }

    const realtimePatched = await this.transitRealtimeOrchestrator.applyRealtime(mapping.routes);

    return {
      source: 'api',
      status: 'OK',
      fetchedAt: odsay.fetchedAt,
      cacheableForMs: odsay.cacheableForMs,
      candidates: realtimePatched,
      diagnostics: mapping.diagnostics,
    };
  }

  private isCoordinateValid(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
}
