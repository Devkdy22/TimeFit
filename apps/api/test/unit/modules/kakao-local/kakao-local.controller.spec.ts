import { BadRequestException } from '@nestjs/common';
import { KakaoLocalController } from '../../../../src/modules/kakao-local/kakao-local.controller';

describe('KakaoLocalController external data proxies', () => {
  const kakaoLocalService = {
    getWalkDirectionsGeometry: jest.fn(),
  };
  const locationService = {};
  const seoulBusClient = {
    findRouteIdsByRouteNo: jest.fn(),
    getRoutePathGeometry: jest.fn(),
    getRouteStations: jest.fn(),
  };

  let controller: KakaoLocalController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new KakaoLocalController(
      kakaoLocalService as never,
      locationService as never,
      seoulBusClient as never,
    );
  });

  it('proxies walking directions to the backend Kakao service', async () => {
    kakaoLocalService.getWalkDirectionsGeometry.mockResolvedValue({
      source: 'api',
      provider: 'kakao-directions',
      isFallback: false,
      fallbackReason: null,
      fetchedAt: '2026-07-16T00:00:00.000Z',
      points: [{ lat: 37.5, lng: 127.0 }],
    });

    const response = await controller.walkDirections('37.5', '127.0', '37.51', '127.01');

    expect(kakaoLocalService.getWalkDirectionsGeometry).toHaveBeenCalledWith(
      { lat: 37.5, lng: 127.0 },
      { lat: 37.51, lng: 127.01 },
    );
    expect(response.success).toBe(true);
    expect(response.data.points).toEqual([{ lat: 37.5, lng: 127.0 }]);
  });

  it('rejects invalid walking direction coordinates', async () => {
    await expect(controller.walkDirections('bad', '127.0', '37.51', '127.01')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('proxies Seoul bus route lookup without exposing keys to mobile', async () => {
    seoulBusClient.findRouteIdsByRouteNo.mockResolvedValue(['100100124']);

    const response = await controller.busRouteIds('  143 ');

    expect(seoulBusClient.findRouteIdsByRouteNo).toHaveBeenCalledWith('143');
    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      source: 'api',
      provider: 'seoul-bus',
      isFallback: false,
      fallbackReason: null,
      routeIds: ['100100124'],
    });
  });

  it('requires a bus route id for Seoul bus geometry proxies', async () => {
    await expect(controller.busRoutePath('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.busStations('  ')).rejects.toBeInstanceOf(BadRequestException);
  });
});
