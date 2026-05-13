import { SafeLogger } from '../../../../../../src/common/logger/safe-logger.service';
import {
  OdsayTooCloseError,
  OdsayTransitClient,
} from '../../../../../../src/modules/recommendation/services/transit/OdsayTransitClient';

describe('OdsayTransitClient', () => {
  const appConfigService = {
    odsayApiKey: 'key',
    odsayApiUrl: 'https://example.com',
  };

  const origin = { name: 'A', lat: 37.5, lng: 127.0 };
  const destination = { name: 'B', lat: 37.6, lng: 127.1 };
  const usageRepo = {
    increment: jest.fn().mockResolvedValue(undefined),
    findByDate: jest.fn().mockResolvedValue(null),
  };

  afterEach(() => {
    jest.restoreAllMocks();
    usageRepo.increment.mockClear();
    usageRepo.findByDate.mockClear();
  });

  it('returns NO_RESULT when result.path is empty', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { path: [] } }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);
    const result = await client.fetchTransitRoutes(origin, destination);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.status).toBe('NO_RESULT');
  });

  it('returns PROVIDER_TIMEOUT on abort timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchMock = jest.fn().mockRejectedValue(abortError);
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);
    const result = await client.fetchTransitRoutes(origin, destination);

    expect(result.status).toBe('PROVIDER_TIMEOUT');
  });

  it('returns PROVIDER_DOWN on 5xx response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);
    const result = await client.fetchTransitRoutes(origin, destination);

    expect(result.status).toBe('PROVIDER_DOWN');
  });

  it('warns when coordinate order looks suspicious', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { path: [] } }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const logger = new SafeLogger();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const client = new OdsayTransitClient(appConfigService as never, logger, usageRepo as never);
    await client.fetchTransitRoutes(
      { name: 'A', lat: 127.0, lng: 37.5 },
      { name: 'B', lat: 127.1, lng: 37.6 },
    );

    expect(
      warnSpy.mock.calls.some(
        (call) =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          'event' in (call[0] as Record<string, unknown>) &&
          (call[0] as Record<string, unknown>).event === 'odsay.request.coordinate_order_suspicious',
      ),
    ).toBe(true);
  });

  it('deduplicates concurrent requests for same route', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          path: [
            {
              pathType: 1,
              info: { totalTime: 20 },
              subPath: [{ trafficType: 2, passStopList: { stations: [{ stationName: '테스트' }] } }],
            },
          ],
        },
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);

    const [a, b] = await Promise.all([
      client.fetchTransitRoutes(origin, destination),
      client.fetchTransitRoutes(origin, destination),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.status).toBe('OK');
    expect(b.status).toBe('OK');
    expect(b.meta?.deduplicated).toBe(true);
  });

  it('uses stale fallback when provider fails after cache warmup', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { path: [{ pathType: 1, info: { totalTime: 20 }, subPath: [] }] } }),
      })
      .mockResolvedValue({
        ok: false,
        status: 503,
      });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);
    const first = await client.fetchTransitRoutes(origin, destination);
    expect(first.status).toBe('OK');

    nowSpy.mockReturnValue(50_000); // fresh cache expired, stale window alive
    const second = await client.fetchTransitRoutes(origin, destination);
    expect(second.status).toBe('OK');
    expect(second.meta?.staleFallback).toBe(true);
  });

  it('tracks daily usage snapshot', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { path: [{ pathType: 1, info: { totalTime: 20 }, subPath: [] }] } }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    usageRepo.findByDate.mockResolvedValueOnce({
      date: '2026-04-28',
      timezone: 'Asia/Seoul',
      totalRequests: 2,
      externalApiCalls: 1,
      cacheHits: 1,
      staleFallbackHits: 0,
      deduplicatedRequests: 0,
      successResponses: 2,
      failedResponses: 0,
    });

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);
    await client.fetchTransitRoutes(origin, destination);
    await client.fetchTransitRoutes(origin, destination); // cache hit

    const usage = await client.getDailyUsageSnapshot('2026-04-28');
    expect(usage.totalRequests).toBe(2);
    expect(usage.externalApiCalls).toBe(1);
    expect(usage.cacheHits).toBe(1);
    expect(usage.successResponses).toBe(2);
  });

  it('throws OdsayTooCloseError when provider returns -98', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        error: {
          code: -98,
          msg: '출, 도착지가 700m이내입니다.',
        },
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as never;

    const client = new OdsayTransitClient(appConfigService as never, new SafeLogger(), usageRepo as never);

    await expect(client.fetchTransitRoutes(origin, destination)).rejects.toBeInstanceOf(OdsayTooCloseError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
