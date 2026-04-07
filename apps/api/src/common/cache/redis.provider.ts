import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class OptionalRedisProvider {
  constructor(private readonly appConfigService: AppConfigService) {}

  isEnabled() {
    return Boolean(this.appConfigService.redisUrl);
  }

  async ping() {
    if (!this.appConfigService.redisUrl) {
      return 'redis-disabled';
    }

    return 'redis-configured-not-connected';
  }
}
