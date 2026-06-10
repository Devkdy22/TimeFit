import test from 'node:test';
import assert from 'node:assert/strict';
import { getStableTimeyState } from '../timeyTransitionGuard';

test('warning hysteresis release threshold', () => {
  assert.equal(getStableTimeyState('warning', 'idle', 2000, { bufferMinutes: 4 }, 0), 'warning');
  assert.equal(getStableTimeyState('warning', 'idle', 2000, { bufferMinutes: 5 }, 0), 'idle');
});

test('urgent hysteresis release threshold', () => {
  assert.equal(getStableTimeyState('urgent', 'warning', 2000, { bufferMinutes: 1 }, 0), 'urgent');
  assert.equal(getStableTimeyState('urgent', 'warning', 2000, { bufferMinutes: 2 }, 0), 'warning');
});

test('panic minimum hold 10s', () => {
  assert.equal(getStableTimeyState('panic', 'walking', 9_000, {}, 0), 'panic');
  assert.equal(getStableTimeyState('panic', 'walking', 10_000, {}, 0), 'walking');
});

test('rerouting/offroute minimum hold 8s', () => {
  assert.equal(getStableTimeyState('rerouting', 'walking', 7_999, {}, 0), 'rerouting');
  assert.equal(getStableTimeyState('rerouting', 'walking', 8_000, {}, 0), 'walking');
  assert.equal(getStableTimeyState('offroute', 'walking', 7_999, {}, 0), 'offroute');
  assert.equal(getStableTimeyState('offroute', 'walking', 8_000, {}, 0), 'walking');
});
