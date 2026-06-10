import { SavedPlacesRepository } from '../../../../src/modules/saved-places/services/saved-places.repository';

type FakeRow = {
  id: string;
  userId: string;
  label: string;
  normalizedLabel: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: Date;
  updatedAt: Date;
};

function makeFakePrisma() {
  const rowsById = new Map<string, FakeRow>();
  const idByUnique = new Map<string, string>();
  let seq = 1;

  const uniqueKey = (userId: string, normalizedLabel: string) => `${userId}::${normalizedLabel}`;

  return {
    savedPlace: {
      async findMany(args: { where: { userId: string }; orderBy: { updatedAt: 'desc' | 'asc' } }) {
        const filtered = [...rowsById.values()].filter((row) => row.userId === args.where.userId);
        const sorted = filtered.sort((a, b) =>
          args.orderBy.updatedAt === 'desc'
            ? b.updatedAt.getTime() - a.updatedAt.getTime()
            : a.updatedAt.getTime() - b.updatedAt.getTime(),
        );
        return sorted;
      },

      async findUnique(args: { where: { id: string }; select: { id: true; userId: true } }) {
        const found = rowsById.get(args.where.id);
        return found ? { id: found.id, userId: found.userId } : null;
      },

      async upsert(args: {
        where: { userId_normalizedLabel: { userId: string; normalizedLabel: string } };
        update: { label: string; address: string; lat: number; lng: number };
        create: { userId: string; label: string; normalizedLabel: string; address: string; lat: number; lng: number };
      }) {
        const { userId, normalizedLabel } = args.where.userId_normalizedLabel;
        const key = uniqueKey(userId, normalizedLabel);
        const existingId = idByUnique.get(key);
        const now = new Date();

        if (existingId) {
          const existing = rowsById.get(existingId)!;
          const next: FakeRow = {
            ...existing,
            label: args.update.label,
            address: args.update.address,
            lat: args.update.lat,
            lng: args.update.lng,
            updatedAt: now,
          };
          rowsById.set(existingId, next);
          return next;
        }

        const id = `place-${seq++}`;
        const created: FakeRow = {
          id,
          userId: args.create.userId,
          label: args.create.label,
          normalizedLabel: args.create.normalizedLabel,
          address: args.create.address,
          lat: args.create.lat,
          lng: args.create.lng,
          createdAt: now,
          updatedAt: now,
        };
        rowsById.set(id, created);
        idByUnique.set(key, id);
        return created;
      },

      async delete(args: { where: { id: string } }) {
        const found = rowsById.get(args.where.id);
        if (!found) {
          throw new Error('record_not_found');
        }
        rowsById.delete(args.where.id);
        idByUnique.delete(uniqueKey(found.userId, found.normalizedLabel));
      },
    },
  };
}

describe('SavedPlacesRepository concurrency', () => {
  it('create/create race converges to single row for same normalized label', async () => {
    const repository = new SavedPlacesRepository();
    (repository as any).prisma = makeFakePrisma();

    const userId = 'user-1';
    await Promise.all([
      repository.createOrUpdateByLabel({
        userId,
        label: 'HOME',
        normalizedLabel: 'home',
        address: 'A',
        lat: 1,
        lng: 1,
      }),
      repository.createOrUpdateByLabel({
        userId,
        label: 'home',
        normalizedLabel: 'home',
        address: 'B',
        lat: 2,
        lng: 2,
      }),
    ]);

    const rows = await repository.findByUser(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label.toLowerCase()).toBe('home');
  });

  it('delete/delete race results in one success and one not-found failure path', async () => {
    const repository = new SavedPlacesRepository();
    (repository as any).prisma = makeFakePrisma();

    const created = await repository.createOrUpdateByLabel({
      userId: 'user-1',
      label: '집',
      normalizedLabel: '집',
      address: 'addr',
      lat: 1,
      lng: 2,
    });

    const first = repository.deleteOwned('user-1', created.id);
    const second = repository.deleteOwned('user-1', created.id);

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((item) => item.status === 'fulfilled');
    const rejected = results.filter((item) => item.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it('multi-device concurrent create/delete keeps final state consistent', async () => {
    const repository = new SavedPlacesRepository();
    (repository as any).prisma = makeFakePrisma();

    const userId = 'user-2';
    const created = await repository.createOrUpdateByLabel({
      userId,
      label: '회사',
      normalizedLabel: '회사',
      address: 'office',
      lat: 10,
      lng: 11,
    });

    await Promise.allSettled([
      repository.deleteOwned(userId, created.id),
      repository.createOrUpdateByLabel({
        userId,
        label: '학교',
        normalizedLabel: '학교',
        address: 'school',
        lat: 12,
        lng: 13,
      }),
    ]);

    const rows = await repository.findByUser(userId);
    const ids = new Set(rows.map((row) => row.id));
    expect(ids.size).toBe(rows.length);
    expect(rows.every((row) => row.userId === userId)).toBe(true);
  });

  it('create/delete race on same logical place keeps state convergent', async () => {
    const repository = new SavedPlacesRepository();
    (repository as any).prisma = makeFakePrisma();

    const userId = 'user-3';
    const existing = await repository.createOrUpdateByLabel({
      userId,
      label: 'HOME',
      normalizedLabel: 'home',
      address: 'old',
      lat: 1,
      lng: 1,
    });

    await Promise.allSettled([
      repository.deleteOwned(userId, existing.id),
      repository.createOrUpdateByLabel({
        userId,
        label: 'home',
        normalizedLabel: 'home',
        address: 'new',
        lat: 2,
        lng: 2,
      }),
    ]);

    const rows = await repository.findByUser(userId);
    expect(rows.length <= 1).toBe(true);
    if (rows.length === 1) {
      expect(rows[0].label.toLowerCase()).toBe('home');
    }
  });
});
