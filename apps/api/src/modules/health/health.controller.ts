import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiResponse } from '../../common/http/api-response';
import { ReadinessService } from './readiness.service';

@Controller()
export class HealthController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('health')
  check() {
    return ApiResponse.ok({
      status: 'ok',
      service: 'timefit-api',
    });
  }

  @Get('ready')
  async ready() {
    try {
      await this.readinessService.checkDatabase();
      return ApiResponse.ok({ status: 'ready', service: 'timefit-api', database: 'ok' });
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable' });
    }
  }
}
