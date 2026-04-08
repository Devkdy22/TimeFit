import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { RoutinesService } from './services/routines.service';

@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  create(@Body() body: CreateRoutineDto) {
    return ApiResponse.ok(this.routinesService.createRoutine(body));
  }

  @Get()
  list(@Query('userId') userId: string) {
    return ApiResponse.ok(this.routinesService.listRoutines(userId));
  }

  @Post(':id/run')
  runNow(@Param('id') routineId: string) {
    return ApiResponse.ok(this.routinesService.runRoutineNow(routineId));
  }
}
