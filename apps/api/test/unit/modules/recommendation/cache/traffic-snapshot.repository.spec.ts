import { TrafficSnapshotRepository } from '../../../../../src/modules/recommendation/cache/traffic-snapshot.repository';

describe('TrafficSnapshotRepository', () => {
  it('reads and updates the latest valid database snapshot', async () => {
    const db = {
      trafficSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'snapshot-1',
          congestionIndex: 0.7,
          ttlSeconds: 60,
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };
    const repository = new TrafficSnapshotRepository();
    jest.spyOn(repository as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockResolvedValue(db);

    await expect(repository.findValidByKey('traffic:key')).resolves.toMatchObject({ congestionIndex: 0.7 });
    await repository.upsert({ key: 'traffic:key', congestionIndex: 0.4, ttlSeconds: 120 });

    expect(db.trafficSnapshot.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'snapshot-1' } }));
    expect(db.trafficSnapshot.create).not.toHaveBeenCalled();
  });

  it('falls back to the in-process cache when the database is unavailable', async () => {
    const repository = new TrafficSnapshotRepository();
    jest.spyOn(repository as unknown as { getPrismaClient: () => Promise<unknown> }, 'getPrismaClient').mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' }),
    );

    await repository.upsert({ key: 'traffic:fallback', congestionIndex: 0.3, ttlSeconds: 60 });
    await expect(repository.findValidByKey('traffic:fallback')).resolves.toMatchObject({ congestionIndex: 0.3 });
  });
});
