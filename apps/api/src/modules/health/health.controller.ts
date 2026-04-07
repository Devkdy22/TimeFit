import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return ApiResponse.ok({
      status: 'ok',
      service: 'timefit-api',
    });
  }
}
