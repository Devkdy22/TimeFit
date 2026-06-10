import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { RoutineIdempotencyStore } from '../../../../../src/modules/routines/services/routine-idempotency.store';

describe('RoutineIdempotencyStore', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns replay response for same key and same payload after completion', () => {
    const store = new RoutineIdempotencyStore();
    const scope = 'user-1:POST:/routines:key-1';
    const payload = { title: '출근 루틴', weekdays: [1, 2] };
    const response = { success: true, data: { id: 'routine-1' } };

    const first = store.begin(scope, payload);
    expect(first.replayed).toBe(false);

    store.complete(scope, payload, response);

    const replay = store.begin(scope, payload);
    expect(replay.replayed).toBe(true);
    expect(replay.response).toEqual(response);
    store.onModuleDestroy();
  });

  it('throws IDEMPOTENCY_PENDING for re-request during pending state', () => {
    const store = new RoutineIdempotencyStore();
    const scope = 'user-1:POST:/routines:key-2';
    store.begin(scope, { title: '저녁 루틴' });

    expect(() => store.begin(scope, { title: '저녁 루틴' })).toThrow(ConflictException);
    expect(() => store.begin(scope, { title: '저녁 루틴' })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_PENDING' }),
      }),
    );
    store.onModuleDestroy();
  });

  it('throws IDEMPOTENCY_CONFLICT for same key with different payload after completion', () => {
    const store = new RoutineIdempotencyStore();
    const scope = 'user-1:POST:/routines:key-3';
    store.begin(scope, { title: '루틴A' });
    store.complete(scope, { title: '루틴A' }, { success: true });

    expect(() => store.begin(scope, { title: '루틴B' })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }),
      }),
    );
    store.onModuleDestroy();
  });

  it('allows retry after pending is cleared', () => {
    const store = new RoutineIdempotencyStore();
    const scope = 'user-1:POST:/routines:key-4';
    const payload = { title: '실패 후 재시도 루틴' };
    store.begin(scope, payload);
    store.clearPending(scope);

    const retried = store.begin(scope, payload);
    expect(retried.replayed).toBe(false);
    store.onModuleDestroy();
  });
});
