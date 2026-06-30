import { Injectable } from '@nestjs/common';
import {
  PostgresIdempotencyStore,
  type IdempotencyBeginInput,
  type IdempotencyReplay,
} from '../../../common/idempotency/postgres-idempotency.store';

@Injectable()
export class SavedPlaceIdempotencyStore {
  constructor(private readonly store: PostgresIdempotencyStore) {}

  begin<TResponse>(input: IdempotencyBeginInput): Promise<IdempotencyReplay<TResponse>> {
    return this.store.begin<TResponse>(input);
  }

  complete(input: IdempotencyBeginInput, responseSnapshot: unknown): Promise<void> {
    return this.store.complete(input, responseSnapshot);
  }

  clearPending(input: Pick<IdempotencyBeginInput, 'userId' | 'scope' | 'key'>): Promise<void> {
    return this.store.clearPending(input);
  }
}
