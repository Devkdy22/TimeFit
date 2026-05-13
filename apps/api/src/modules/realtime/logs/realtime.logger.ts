import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';
import type { RealtimeEtaResponse } from '../realtime.types';

@Injectable()
export class RealtimeLogger {
  constructor(private readonly logger: SafeLogger) {}

  logResult(label: 'BUS' | 'SUBWAY', result: RealtimeEtaResponse, latencyMs: number) {
    const statusLabel =
      result.status === 'LIVE' || result.status === 'DELAYED'
        ? 'SUCCESS'
        : result.status === 'STALE'
          ? 'STALE'
          : 'FAIL';

    this.logger.log(
      {
        event: `realtime.${label.toLowerCase()}.result`,
        status: result.status,
        reasonCode: result.reasonCode,
        etaMinutes: result.etaMinutes,
        source: result.source,
        latencyMs,
      },
      `[Realtime] ${label} ${statusLabel}`,
    );
  }
}

