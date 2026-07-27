import { formatRealtimeAge, matchingConfidenceLabel, realtimeSourceLabel, realtimeStatusLabel, resolveDisplayedRealtimeStatus } from './realtimePresentation';

describe('realtimePresentation', () => {
  it('labels live, stale, and unavailable states', () => {
    expect(realtimeStatusLabel('LIVE')).toBe('실시간 수신 중');
    expect(realtimeStatusLabel('STALE')).toBe('이전 정보');
    expect(realtimeStatusLabel('UNAVAILABLE')).toBe('정보 없음');
  });

  it('formats the age of the provider timestamp', () => {
    const now = Date.parse('2026-07-21T08:10:00.000Z');
    expect(formatRealtimeAge('2026-07-21T08:10:00.000Z', now)).toBe('방금 전');
    expect(formatRealtimeAge('2026-07-21T08:07:00.000Z', now)).toBe('3분 전');
    expect(formatRealtimeAge(undefined, now)).toBe('시각 없음');
  });

  it('downgrades live data to stale after the UI freshness threshold', () => {
    const now = Date.parse('2026-07-21T08:10:00.000Z');
    expect(resolveDisplayedRealtimeStatus('LIVE', '2026-07-21T08:08:01.000Z', now)).toBe('LIVE');
    expect(resolveDisplayedRealtimeStatus('LIVE', '2026-07-21T08:07:59.000Z', now)).toBe('STALE');
    expect(resolveDisplayedRealtimeStatus('DELAYED', undefined, now)).toBe('UNAVAILABLE');
    expect(resolveDisplayedRealtimeStatus('STALE', undefined, now)).toBe('STALE');
  });

  it('turns matching confidence into a user-facing label', () => {
    expect(matchingConfidenceLabel(0.9)).toBe('높음');
    expect(matchingConfidenceLabel(0.6)).toBe('보통');
    expect(matchingConfidenceLabel(0.2)).toBe('낮음');
    expect(matchingConfidenceLabel()).toBe('확인 중');
  });

  it('labels realtime provider sources without implying a provider when none exists', () => {
    expect(realtimeSourceLabel('SEOUL_API')).toBe('서울 API');
    expect(realtimeSourceLabel('CACHE')).toBe('캐시 정보');
    expect(realtimeSourceLabel()).toBe('수신 없음');
  });
});
