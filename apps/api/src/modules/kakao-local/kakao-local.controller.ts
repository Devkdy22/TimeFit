import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { SeoulBusClient } from '../recommendation/integrations/seoul-bus.client';
import { KakaoLocalService } from './kakao-local.service';
import { LocationService, type NearbyPoiResponse } from './location.service';

@Controller('kakao-local')
export class KakaoLocalController {
  constructor(
    private readonly kakaoLocalService: KakaoLocalService,
    private readonly locationService: LocationService,
    private readonly seoulBusClient: SeoulBusClient,
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
    @Query('selectedName') selectedName?: string,
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

    const data = await this.locationService.getNearbyPoi(lat, lng, radius, selectedName);
    return ApiResponse.ok(data);
  }

  @Get('directions/walk')
  async walkDirections(
    @Query('originLat') originLatText: string,
    @Query('originLng') originLngText: string,
    @Query('destinationLat') destinationLatText: string,
    @Query('destinationLng') destinationLngText: string,
  ) {
    const originLat = Number(originLatText);
    const originLng = Number(originLngText);
    const destinationLat = Number(destinationLatText);
    const destinationLng = Number(destinationLngText);
    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destinationLat) ||
      !Number.isFinite(destinationLng)
    ) {
      throw new BadRequestException('origin and destination coordinates must be valid numbers');
    }

    const data = await this.kakaoLocalService.getWalkDirectionsGeometry(
      { lat: originLat, lng: originLng },
      { lat: destinationLat, lng: destinationLng },
    );
    return ApiResponse.ok(data);
  }

  @Get('bus/routes')
  async busRouteIds(@Query('routeNo') routeNo: string) {
    const normalized = routeNo?.trim();
    if (!normalized) {
      throw new BadRequestException('routeNo is required');
    }
    const routeIds = await this.seoulBusClient.findRouteIdsByRouteNo(normalized);
    return ApiResponse.ok({
      source: 'api',
      provider: 'seoul-bus',
      isFallback: false,
      fallbackReason: null,
      fetchedAt: new Date().toISOString(),
      routeIds,
    });
  }

  @Get('bus/route-path')
  async busRoutePath(@Query('busRouteId') busRouteId: string) {
    const normalized = busRouteId?.trim();
    if (!normalized) {
      throw new BadRequestException('busRouteId is required');
    }
    const points = await this.seoulBusClient.getRoutePathGeometry(normalized);
    return ApiResponse.ok({
      source: 'api',
      provider: 'seoul-bus',
      isFallback: false,
      fallbackReason: null,
      fetchedAt: new Date().toISOString(),
      points,
    });
  }

  @Get('bus/stations')
  async busStations(@Query('busRouteId') busRouteId: string) {
    const normalized = busRouteId?.trim();
    if (!normalized) {
      throw new BadRequestException('busRouteId is required');
    }
    const stations = await this.seoulBusClient.getRouteStations(normalized);
    return ApiResponse.ok({
      source: 'api',
      provider: 'seoul-bus',
      isFallback: false,
      fallbackReason: null,
      fetchedAt: new Date().toISOString(),
      stations,
    });
  }
}
