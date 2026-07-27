import { getStableTimeyState } from '../timeyTransitionGuard';

test('warning hysteresis release threshold', () => {
  expect(getStableTimeyState('warning', 'idle', 2000, { bufferMinutes: 4 }, 0)).toBe('warning');
  expect(getStableTimeyState('warning', 'idle', 2000, { bufferMinutes: 5 }, 0)).toBe('idle');
});

test('urgent hysteresis release threshold', () => {
  expect(getStableTimeyState('urgent', 'warning', 2000, { bufferMinutes: 1 }, 0)).toBe('urgent');
  expect(getStableTimeyState('urgent', 'warning', 2000, { bufferMinutes: 2 }, 0)).toBe('warning');
});

test('panic minimum hold 10s', () => {
  expect(getStableTimeyState('panic', 'walking', 9_000, {}, 0)).toBe('panic');
  expect(getStableTimeyState('panic', 'walking', 10_000, {}, 0)).toBe('walking');
});

test('rerouting/offroute minimum hold 8s', () => {
  expect(getStableTimeyState('rerouting', 'walking', 7_999, {}, 0)).toBe('rerouting');
  expect(getStableTimeyState('rerouting', 'walking', 8_000, {}, 0)).toBe('walking');
  expect(getStableTimeyState('offroute', 'walking', 7_999, {}, 0)).toBe('offroute');
  expect(getStableTimeyState('offroute', 'walking', 8_000, {}, 0)).toBe('walking');
});
