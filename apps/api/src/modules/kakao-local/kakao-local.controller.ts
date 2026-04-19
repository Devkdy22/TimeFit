import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { KakaoLocalService } from './kakao-local.service';
import { LocationService, type NearbyPoiResponse } from './location.service';

@Controller('kakao-local')
export class KakaoLocalController {
  constructor(
    private readonly kakaoLocalService: KakaoLocalService,
    private readonly locationService: LocationService,
  ) {}

  @Get('search/keyword')
  async searchKeyword(
    @Query('query') query: string,
    @Query('size') sizeText?: string,
  ) {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery) {
      throw new BadRequestException('query is required');
    }

    const parsedSize = Number(sizeText);
    const size = Number.isFinite(parsedSize)
      ? Math.max(1, Math.min(15, Math.floor(parsedSize)))
      : 8;

    const data = await this.kakaoLocalService.searchKeyword(normalizedQuery, size);
    return ApiResponse.ok(data);
  }

  @Get('geo/coord2address')
  async coord2Address(
    @Query('lat') latText: string,
    @Query('lng') lngText: string,
  ) {
    const lat = Number(latText);
    const lng = Number(lngText);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }

    const data = await this.kakaoLocalService.coord2Address(lat, lng);
    return ApiResponse.ok(data);
  }

  @Get('search/nearby-place')
  async searchNearbyPlace(
    @Query('lat') latText: string,
    @Query('lng') lngText: string,
    @Query('radius') radiusText?: string,
  ) {
    const lat = Number(latText);
    const lng = Number(lngText);
    const parsedRadius = Number(radiusText);
    const radius = Number.isFinite(parsedRadius) ? Math.max(20, Math.min(2000, Math.floor(parsedRadius))) : 300;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }

    const data = await this.kakaoLocalService.searchNearbyPlaceName(lat, lng, radius);
    return ApiResponse.ok(data);
  }

  @Get('nearby-poi')
  async nearbyPoi(
    @Query('lat') latText: string,
    @Query('lng') lngText: string,
    @Query('radius') radiusText?: string,
  ): Promise<{
    success: true;
    data: NearbyPoiResponse;
    timestamp: string;
  }> {
    const lat = Number(latText);
    const lng = Number(lngText);
    const parsedRadius = Number(radiusText);
    const radius = Number.isFinite(parsedRadius) ? Math.max(200, Math.min(250, Math.floor(parsedRadius))) : 250;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('lat and lng must be valid numbers');
    }

    const data = await this.locationService.getNearbyPoi(lat, lng, radius);
    return ApiResponse.ok(data);
  }
}
