import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { StartTripDto } from './dto/start-trip.dto';
import { TripsService } from './services/trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('start')
  start(@Body() body: StartTripDto) {
    return ApiResponse.ok(this.tripsService.startTrip(body));
  }

  @Get(':id/live')
  live(@Param('id') tripId: string) {
    return ApiResponse.ok(this.tripsService.getLive(tripId));
  }
}
