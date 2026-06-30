import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoutinesRepository } from '../../../../../src/modules/routines/services/routines.repository';

function createRoutineDb() {
  type Row = {
    id: string;
    userId: string;
    title: string;
    originName: string;
    originLat: number;
    originLng: number;
    destinationName: string;
    destinationLat: number;
    destinationLng: number;
    weekdays: number[];
    arrivalTime: string;
    notificationEnabled: boolean;
    notificationMinutesBefore: number;
    favorite: boolean;
    active: boolean;
    savedRoute: unknown | null;
    expoPushToken: string | null;
    lastTriggeredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const rows = new Map<string, Row>();
  let seq = 0;

  return {
    rows,
    client: {
      routine: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const now = new Date();
          const row = {
            id: `routine-${++seq}`,
            userId: data.userId as string,
            title: data.title as string,
            originName: data.originName as string,
            originLat: data.originLat as number,
            originLng: data.originLng as number,
            destinationName: data.destinationName as string,
            destinationLat: data.destinationLat as number,
            destinationLng: data.destinationLng as number,
            weekdays: data.weekdays as number[],
            arrivalTime: data.arrivalTime as string,
            notificationEnabled: data.notificationEnabled as boolean,
            notificationMinutesBefore: data.notificationMinutesBefore as number,
            favorite: data.favorite as boolean,
            active: data.active as boolean,
            savedRoute: data.savedRoute ?? null,
            expoPushToken: (data.expoPushToken as string | undefined) ?? null,
            lastTriggeredAt: null,
            createdAt: now,
            updatedAt: now,
          };
          rows.set(row.id, row);
          return row;
        }),
        findMany: jest.fn(
          async ({ where }: { where: { userId?: string; active?: boolean } }) =>
            [...rows.values()].filter((row) => {
              if (where.userId !== undefined && row.userId !== where.userId) {
                return false;
              }
              if (where.active !== undefined && row.active !== where.active) {
                return false;
              }
              return true;
            }),
        ),
        findUnique: jest.fn(
          async ({ where, select }: { where: { id: string }; select?: { id: true; userId: true } }) => {
            const row = rows.get(where.id) ?? null;
            if (row && select) {
              return { id: row.id, userId: row.userId };
            }
            return row;
          },
        ),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const current = rows.get(where.id);
          if (!current) {
            throw new Error('missing routine');
          }
          const next = { ...current, ...data, updatedAt: new Date() };
          rows.set(where.id, next);
          return next;
        }),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
          rows.delete(where.id);
        }),
      },
    },
  };
}

function createRepository(db = createRoutineDb()) {
  const repository = new RoutinesRepository();
  (
    jest.spyOn(
      repository as unknown as { getPrismaClient: () => Promise<unknown> },
      'getPrismaClient',
    ) as jest.Mock
  ).mockResolvedValue(db.client);
  return { repository, db };
}

const baseInput = {
  userId: 'user-a',
  title: '출근',
  origin: { name: '집', lat: 37.1, lng: 127.1 },
  destination: { name: '회사', lat: 37.2, lng: 127.2 },
  weekdays: [5, 1, 1],
  arrivalTime: '08:50',
  notificationEnabled: true,
  notificationMinutesBefore: 10,
  favorite: false,
};

describe('RoutinesRepository Prisma CRUD', () => {
  it('creates and lists routines by owner with normalized weekdays', async () => {
    const { repository } = createRepository();
    const created = await repository.create(baseInput);

    expect(created.weekdays).toEqual([1, 5]);
    await repository.create({ ...baseInput, userId: 'user-b', title: '타 사용자 루틴' });

    await expect(repository.findByUser('user-a')).resolves.toEqual([created]);
  });

  it('updates favorite and active only for the owner', async () => {
    const { repository } = createRepository();
    const created = await repository.create(baseInput);

    await expect(
      repository.updateOwned('user-b', created.id, { favorite: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const updated = await repository.updateOwned('user-a', created.id, {
      favorite: true,
      active: false,
    });

    expect(updated.favorite).toBe(true);
    expect(updated.active).toBe(false);
  });

  it('deletes only owner routines and hides deleted rows from lists', async () => {
    const { repository } = createRepository();
    const created = await repository.create(baseInput);

    await expect(repository.deleteOwned('user-b', created.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await repository.deleteOwned('user-a', created.id);

    await expect(repository.findByUser('user-a')).resolves.toEqual([]);
    await expect(repository.findOwned('user-a', created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks owner routines as triggered for run flows', async () => {
    const { repository } = createRepository();
    const created = await repository.create(baseInput);

    const owned = await repository.findOwned('user-a', created.id);
    const triggered = await repository.markTriggered(owned.id, '2026-06-15T08:00:00.000Z');

    expect(triggered.lastTriggeredAt).toBe('2026-06-15T08:00:00.000Z');
  });
});
