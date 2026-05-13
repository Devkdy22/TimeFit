import { Controller, Get, Query } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get('eta')
  async getEta(
    @Query('type') type: 'BUS' | 'SUBWAY',
    @Query('stationId') stationId?: string,
    @Query('routeId') routeId?: string,
    @Query('arsId') arsId?: string,
    @Query('routeNo') routeNo?: string,
    @Query('station') station?: string,
    @Query('line') line?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    if (type === 'SUBWAY') {
      return this.realtimeService.getSubwayEta({
        station: station ?? '',
        line: line ?? '',
      });
    }

    return this.realtimeService.getBusEta({
      stationId,
      routeId,
      arsId,
      routeNo,
      stationName: station,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });
  }
}

