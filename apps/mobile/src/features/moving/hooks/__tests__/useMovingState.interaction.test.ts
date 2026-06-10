import { shouldAutoStartTracking } from '../autoStartGuard';

describe('useMovingState interaction verification', () => {
  it('tracking key가 없으면 자동 시작하지 않는다', () => {
    expect(
      shouldAutoStartTracking({
        trackingKey: null,
        isRunning: false,
        attemptedKey: null,
      }),
    ).toBe(false);
  });

  it('이미 running이면 자동 시작하지 않는다', () => {
    expect(
      shouldAutoStartTracking({
        trackingKey: 'k1',
        isRunning: true,
        attemptedKey: null,
      }),
    ).toBe(false);
  });

  it('같은 key로 이미 시도했으면 double start를 막는다', () => {
    expect(
      shouldAutoStartTracking({
        trackingKey: 'k1',
        isRunning: false,
        attemptedKey: 'k1',
      }),
    ).toBe(false);
  });

  it('새 key이고 running이 아니면 자동 시작한다', () => {
    expect(
      shouldAutoStartTracking({
        trackingKey: 'k2',
        isRunning: false,
        attemptedKey: 'k1',
      }),
    ).toBe(true);
  });
});
