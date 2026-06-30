import { ConflictException } from '@nestjs/common';
import { PostgresIdempotencyStore } from '../../../../../src/common/idempotency/postgres-idempotency.store';

type FakeRow = {
  id: string;
  userId: string;
  scope: string;
  key: string;
  payloadHash: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  responseSnapshot: unknown | null;
  expiresAt: Date;
};

function fakePrisma() {
  const rows = new Map<string, FakeRow>();
  let seq = 1;
  const uniqueKey = (userId: string, scope: string, key: string) => `${userId}:${scope}:${key}`;

  return {
    idempotencyKey: {
      async create(args: {
        data: {
          userId: string;
          scope: string;
          key: string;
          payloadHash: string;
          status: 'PENDING' | 'COMPLETED' | 'FAILED';
          expiresAt: Date;
        };
      }) {
        const mapKey = uniqueKey(args.data.userId, args.data.scope, args.data.key);
        if (rows.has(mapKey)) {
          const error = new Error('unique conflict') as Error & { code: string };
          error.code = 'P2002';
          throw error;
        }
        const row: FakeRow = {
          id: `idempotency-${seq++}`,
          responseSnapshot: null,
          ...args.data,
        };
        rows.set(mapKey, row);
        return row;
      },

      async findUnique(args: {
        where: { userId_scope_key: { userId: string; scope: string; key: string } };
      }) {
        const { userId, scope, key } = args.where.userId_scope_key;
        return rows.get(uniqueKey(userId, scope, key)) ?? null;
      },

      async update(args: {
        where: { userId_scope_key: { userId: string; scope: string; key: string } };
        data: {
          status: 'PENDING' | 'COMPLETED' | 'FAILED';
          responseSnapshot?: unknown;
          expiresAt?: Date;
        };
      }) {
        const { userId, scope, key } = args.where.userId_scope_key;
        const mapKey = uniqueKey(userId, scope, key);
        const existing = rows.get(mapKey);
        if (!existing) {
          throw new Error('record_not_found');
        }
        const next = { ...existing, ...args.data };
        rows.set(mapKey, next);
        return next;
      },

      async deleteMany(args: {
        where: {
          userId?: string;
          scope?: string;
          key?: string;
          status?: 'PENDING' | 'COMPLETED' | 'FAILED';
          expiresAt?: { lte: Date };
        };
      }) {
        let count = 0;
        for (const [key, row] of rows.entries()) {
          if (args.where.userId !== undefined && row.userId !== args.where.userId) {
            continue;
          }
          if (args.where.scope !== undefined && row.scope !== args.where.scope) {
            continue;
          }
          if (args.where.key !== undefined && row.key !== args.where.key) {
            continue;
          }
          if (args.where.status !== undefined && row.status !== args.where.status) {
            continue;
          }
          if (args.where.expiresAt && row.expiresAt.getTime() > args.where.expiresAt.lte.getTime()) {
            continue;
          }
          rows.delete(key);
          count += 1;
        }
        return { count };
      },
    },
  };
}

function createStore() {
  const store = new PostgresIdempotencyStore();
  (store as unknown as { prisma: ReturnType<typeof fakePrisma> }).prisma = fakePrisma();
  return store;
}

const baseInput = {
  userId: 'user-1',
  scope: 'routine:create',
  key: 'key-1',
  payload: { title: '출근 루틴', weekdays: [1, 2] },
};

describe('PostgresIdempotencyStore', () => {
  it('returns replay response for same key and same payload after completion', async () => {
    const store = createStore();
    const response = { success: true, data: { id: 'routine-1' } };

    const first = await store.begin(baseInput);
    expect(first.replayed).toBe(false);

    await store.complete(baseInput, response);

    const replay = await store.begin(baseInput);
    expect(replay.replayed).toBe(true);
    expect(replay.response).toEqual(response);
  });

  it('throws IDEMPOTENCY_PENDING for re-request during pending state', async () => {
    const store = createStore();
    await store.begin(baseInput);

    await expect(store.begin(baseInput)).rejects.toThrow(ConflictException);
    await expect(store.begin(baseInput)).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_PENDING' }),
      }),
    );
  });

  it('throws IDEMPOTENCY_CONFLICT for same key with different payload after completion', async () => {
    const store = createStore();
    await store.begin(baseInput);
    await store.complete(baseInput, { success: true });

    await expect(store.begin({ ...baseInput, payload: { title: '루틴B' } })).rejects.toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }),
      }),
    );
  });

  it('allows retry after pending is cleared', async () => {
    const store = createStore();
    await store.begin(baseInput);
    await store.clearPending(baseInput);

    const retried = await store.begin(baseInput);
    expect(retried.replayed).toBe(false);
  });
});
