import { SafeLogger } from '../../../../../src/common/logger/safe-logger.service';
import { KakaoMapClient } from '../../../../../src/modules/recommendation/integrations/kakao-map.client';

describe('KakaoMapClient', () => {
  function createClient(status: string, paths: unknown[] = []) {
    const odsayTransitClient = {
      fetchTransitRoutes: jest.fn().mockResolvedValue({
        status,
        paths,
        fetchedAt: new Date().toISOString(),
        cacheableForMs: 1000,
      }),
    };
    const realtimeOrchestrator = { applyRealtime: jest.fn() };
    return new KakaoMapClient(
      new SafeLogger(),
      odsayTransitClient as never,
      realtimeOrchestrator as never,
    );
  }

  it('returns NO_RESULT when ODsay has no path', async () => {
    const client = createClient('NO_RESULT');

    const result = await client.getRouteCandidates(
      { name: 'A', lat: 37.5, lng: 127 },
      { name: 'B', lat: 37.501, lng: 127.001 },
    );

    expect(result.status).toBe('ROUTE_NOT_FOUND');
    expect(result.candidates).toHaveLength(0);
  });

  it.each([
    ['PROVIDER_TIMEOUT', 'ROUTE_PROVIDER_DOWN'],
    ['PROVIDER_DOWN', 'ROUTE_PROVIDER_DOWN'],
    ['PROVIDER_UNAVAILABLE', 'PROVIDER_UNAVAILABLE'],
    ['APPLICATION_ERROR', 'APPLICATION_ERROR'],
  ])('does not return candidates for %s', async (providerStatus, publicStatus) => {
    const client = createClient(providerStatus);
    const result = await client.getRouteCandidates(
      { name: 'A', lat: 37.5, lng: 127 },
      { name: 'B', lat: 37.501, lng: 127.001 },
    );

    expect(result.status).toBe(publicStatus);
    expect(result.candidates).toEqual([]);
    expect(result.source).toBe('fallback');
  });
});
