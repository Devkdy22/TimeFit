import { Injectable } from '@nestjs/common';
import { SafeLogger } from '../../../common/logger/safe-logger.service';

export type SavedPlacesMetricName =
  | 'saved_place_create_total'
  | 'saved_place_delete_total'
  | 'saved_place_create_failed_total'
  | 'saved_place_forbidden_total'
  | 'saved_place_idempotency_hit_total';

@Injectable()
export class SavedPlacesMetrics {
  private readonly counters = new Map<SavedPlacesMetricName, number>();

  constructor(private readonly logger: SafeLogger) {}

  increment(metric: SavedPlacesMetricName, payload?: Record<string, unknown>) {
    const next = (this.counters.get(metric) ?? 0) + 1;
    this.counters.set(metric, next);

    this.logger.log(
      {
        event: 'saved_places.metric',
        metric,
        value: 1,
        total: next,
        ...payload,
      },
      SavedPlacesMetrics.name,
    );
  }

  snapshot(): Record<string, number> {
    return {
      saved_place_create_total: this.counters.get('saved_place_create_total') ?? 0,
      saved_place_delete_total: this.counters.get('saved_place_delete_total') ?? 0,
      saved_place_create_failed_total: this.counters.get('saved_place_create_failed_total') ?? 0,
      saved_place_forbidden_total: this.counters.get('saved_place_forbidden_total') ?? 0,
      saved_place_idempotency_hit_total: this.counters.get('saved_place_idempotency_hit_total') ?? 0,
    };
  }
}
