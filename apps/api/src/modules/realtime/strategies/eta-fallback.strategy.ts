import { Injectable } from '@nestjs/common';
import type { RealtimeEtaResponse, RealtimeReasonCode, RealtimeType } from '../realtime.types';

@Injectable()
export class EtaFallbackStrategy {
  apply(
    input: {
      type: RealtimeType;
      stale: RealtimeEtaResponse | null;
      failureCount: number;
      reasonCode: RealtimeReasonCode;
    },
  ): RealtimeEtaResponse {
    const now = new Date().toISOString();

    if (input.stale && input.stale.etaMinutes !== null) {
      return {
        ...input.stale,
        status: 'STALE',
        source: 'CACHE',
        reasonCode: 'CACHE_STALE_USED',
        updatedAt: now,
      };
    }

    if (input.failureCount < 3) {
      return {
        type: input.type,
        status: 'CHECKING',
        etaMinutes: null,
        source: 'CACHE',
        reasonCode: input.reasonCode,
        updatedAt: now,
      };
    }

    return {
      type: input.type,
      status: 'UNAVAILABLE',
      etaMinutes: null,
      source: 'CACHE',
      reasonCode: input.reasonCode,
      updatedAt: now,
    };
  }
}

