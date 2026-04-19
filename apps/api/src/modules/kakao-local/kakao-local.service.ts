import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { SafeLogger } from '../../common/logger/safe-logger.service';
import { fetchJsonWithTimeout } from '../recommendation/utils/http-client.util';

export interface KakaoKeywordDocument {
  place_name?: string;
  category_group_code?: string;
  road_address_name?: string;
  address_name?: string;
  distance?: string;
  x?: string;
  y?: string;
}

interface KakaoKeywordSearchResponse {
  documents?: KakaoKeywordDocument[];
}

export interface KakaoAddressDocument {
  road_address?: { address_name?: string; building_name?: string };
  address?: { address_name?: string };
}

interface KakaoCoord2AddressResponse {
  documents?: KakaoAddressDocument[];
}

export interface KakaoCategoryDocument {
  place_name?: string;
  category_group_code?: string;
  road_address_name?: string;
  address_name?: string;
  distance?: string;
  x?: string;
  y?: string;
}

interface KakaoCategorySearchResponse {
  documents?: KakaoCategoryDocument[];
}

@Injectable()
export class KakaoLocalService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly logger: SafeLogger,
  ) {}

  private getRestApiKey() {
    const restApiKey = this.appConfigService.kakaoRestApiKey;
    if (!restApiKey) {
      throw new ServiceUnavailableException('KAKAO_REST_API_KEY is not configured');
    }
    return restApiKey;
  }

  async searchKeyword(query: string, size: number) {
    const restApiKey = this.getRestApiKey();

    this.logger.log(
      {
        event: 'kakao.local.proxy.request.start',
        endpoint: 'search/keyword',
        keyType: 'REST',
        query,
        size,
      },
      KakaoLocalService.name,
    );

    const params = new URLSearchParams({
      query,
      size: String(size),
    });

    const response = await fetchJsonWithTimeout<KakaoKeywordSearchResponse>(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      },
      3500,
    );

    const documents = response.documents ?? [];

    this.logger.log(
      {
        event: 'kakao.local.proxy.request.success',
        endpoint: 'search/keyword',
        keyType: 'REST',
        count: documents.length,
      },
      KakaoLocalService.name,
    );

    return { documents };
  }

  async coord2Address(lat: number, lng: number) {
    const restApiKey = this.getRestApiKey();

    this.logger.log(
      {
        event: 'kakao.local.proxy.request.start',
        endpoint: 'geo/coord2address',
        keyType: 'REST',
        lat,
        lng,
      },
      KakaoLocalService.name,
    );

    const params = new URLSearchParams({
      x: String(lng),
      y: String(lat),
    });

    const response = await fetchJsonWithTimeout<KakaoCoord2AddressResponse>(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      },
      3500,
    );

    const document = response.documents?.[0] ?? null;

    this.logger.log(
      {
        event: 'kakao.local.proxy.request.success',
        endpoint: 'geo/coord2address',
        keyType: 'REST',
        found: Boolean(document),
      },
      KakaoLocalService.name,
    );

    return { document };
  }

  async searchCategoryNearby(
    lat: number,
    lng: number,
    radius: number,
    category: string,
    size: number,
  ) {
    const restApiKey = this.getRestApiKey();

    const params = new URLSearchParams({
      category_group_code: category,
      x: String(lng),
      y: String(lat),
      radius: String(radius),
      sort: 'distance',
      page: '1',
      size: String(size),
    });

    const response = await fetchJsonWithTimeout<KakaoCategorySearchResponse>(
      `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      },
      3500,
    );

    return { documents: response.documents ?? [] };
  }

  async searchKeywordNearby(lat: number, lng: number, radius: number, query: string, size: number) {
    const restApiKey = this.getRestApiKey();

    const params = new URLSearchParams({
      query,
      x: String(lng),
      y: String(lat),
      radius: String(radius),
      sort: 'distance',
      page: '1',
      size: String(size),
    });

    const response = await fetchJsonWithTimeout<KakaoKeywordSearchResponse>(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `KakaoAK ${restApiKey}`,
        },
      },
      3500,
    );

    return { documents: response.documents ?? [] };
  }

  async searchNearbyPlaceName(lat: number, lng: number, radius: number) {
    const categories = ['FD6', 'CE7', 'AT4', 'OL7', 'SW8'];
    const settled = await Promise.allSettled(
      categories.map((category) => this.searchCategoryNearby(lat, lng, radius, category, 1)),
    );

    const docs = settled
      .filter(
        (item): item is PromiseFulfilledResult<{ documents: KakaoCategoryDocument[] }> =>
          item.status === 'fulfilled',
      )
      .flatMap((item) => item.value.documents)
      .filter((doc) => Boolean(doc.place_name?.trim()));

    const best = docs
      .map((doc) => ({
        placeName: doc.place_name?.trim() ?? '',
        address: doc.road_address_name?.trim() || doc.address_name?.trim() || '',
        distance: Number(doc.distance),
      }))
      .filter((doc) => doc.placeName.length > 0)
      .sort((a, b) => (Number.isFinite(a.distance) ? a.distance : Number.POSITIVE_INFINITY) - (Number.isFinite(b.distance) ? b.distance : Number.POSITIVE_INFINITY))[0];

    return {
      placeName: best?.placeName ?? null,
      address: best?.address ?? '',
      distance: best && Number.isFinite(best.distance) ? best.distance : null,
    };
  }
}

