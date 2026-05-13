import { EtaFallbackStrategy } from '../../../../../src/modules/realtime/strategies/eta-fallback.strategy';

describe('EtaFallbackStrategy', () => {
  const strategy = new EtaFallbackStrategy();

  it('returns STALE when stale cache exists', () => {
    const result = strategy.apply({
      type: 'BUS',
      stale: {
        type: 'BUS',
        status: 'LIVE',
        etaMinutes: 4,
        source: 'SEOUL_API',
        reasonCode: null,
        updatedAt: new Date().toISOString(),
      },
      failureCount: 1,
      reasonCode: 'BUS_API_TIMEOUT',
    });

    expect(result.status).toBe('STALE');
    expect(result.etaMinutes).toBe(4);
    expect(result.reasonCode).toBe('CACHE_STALE_USED');
  });

  it('returns CHECKING before 3 failures when no stale cache', () => {
    const result = strategy.apply({
      type: 'SUBWAY',
      stale: null,
      failureCount: 2,
      reasonCode: 'SUBWAY_API_TIMEOUT',
    });
    expect(result.status).toBe('CHECKING');
  });

  it('returns UNAVAILABLE after 3 failures', () => {
    const result = strategy.apply({
      type: 'SUBWAY',
      stale: null,
      failureCount: 3,
      reasonCode: 'SUBWAY_EMPTY_RESPONSE',
    });
    expect(result.status).toBe('UNAVAILABLE');
  });
});

