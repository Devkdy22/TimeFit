import { OdsayUsageRepository } from '../../../../../src/modules/recommendation/cache/odsay-usage.repository';

describe('OdsayUsageRepository', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs DB connection warning only once and suppresses repeated connection failures', async () => {
    const repo = new OdsayUsageRepository();
    const upsert = jest.fn().mockRejectedValue({
      code: 'P1001',
      message: "Can't reach database server at localhost:5432",
    });

    jest.spyOn(repo as unknown as { getPrismaClient: () => unknown }, 'getPrismaClient').mockReturnValue({
      odsayUsageDaily: { upsert },
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(repo.increment('2026-05-12', 'Asia/Seoul', { totalRequests: 1 })).resolves.toBeUndefined();
    await expect(repo.increment('2026-05-12', 'Asia/Seoul', { totalRequests: 1 })).resolves.toBeUndefined();

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('re-throws non connection errors', async () => {
    const repo = new OdsayUsageRepository();
    const upsert = jest.fn().mockRejectedValue(new Error('unexpected_upsert_error'));

    jest.spyOn(repo as unknown as { getPrismaClient: () => unknown }, 'getPrismaClient').mockReturnValue({
      odsayUsageDaily: { upsert },
    });

    await expect(repo.increment('2026-05-12', 'Asia/Seoul', { totalRequests: 1 })).rejects.toThrow(
      'unexpected_upsert_error',
    );
  });
});
