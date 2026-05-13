import { SafeLogger } from '../../../../../src/common/logger/safe-logger.service';
import { KakaoMapClient } from '../../../../../src/modules/recommendation/integrations/kakao-map.client';

describe('KakaoMapClient', () => {
  it('returns NO_RESULT when ODsay has no path', async () => {
    const odsayTransitClient = {
      fetchTransitRoutes: jest.fn().mockResolvedValue({
        status: 'NO_RESULT',
        paths: [],
        fetchedAt: new Date().toISOString(),
        cacheableForMs: 1000,
      }),
    };
    const realtimeOrchestrator = {
      applyRealtime: jest.fn(),
    };

    const client = new KakaoMapClient(
      new SafeLogger(),
      odsayTransitClient as never,
      realtimeOrchestrator as never,
    );

    const result = await client.getRouteCandidates(
      { name: 'A', lat: 37.5, lng: 127 },
      { name: 'B', lat: 37.501, lng: 127.001 },
    );

    expect(result.status).toBe('NO_RESULT');
    expect(result.candidates).toHaveLength(0);
  });
});
