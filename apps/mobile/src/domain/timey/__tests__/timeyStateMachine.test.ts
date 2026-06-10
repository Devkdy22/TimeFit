import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTimeyStateMachine } from '../timeyStateMachine';

test('arrived has highest priority', () => {
  const state = resolveTimeyStateMachine({ tripStatus: 'ARRIVED', isOffRoute: true, delayRiskLevel: 'HIGH' });
  assert.equal(state, 'success');
});

test('priority chain and mode states', () => {
  assert.equal(resolveTimeyStateMachine({ isOffRoute: true }), 'offroute');
  assert.equal(resolveTimeyStateMachine({ isRerouting: true }), 'rerouting');
  assert.equal(resolveTimeyStateMachine({ delayRiskLevel: 'HIGH' }), 'panic');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: -5 }), 'urgent');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 0 }), 'urgent');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 1 }), 'warning');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 3 }), 'warning');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 4 }), 'idle');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 5 }), 'idle');
  assert.equal(resolveTimeyStateMachine({ bufferMinutes: 10 }), 'confident');
  assert.equal(resolveTimeyStateMachine({ isSearching: true }), 'searching');
  assert.equal(resolveTimeyStateMachine({ currentMode: 'WALK' }), 'walking');
  assert.equal(resolveTimeyStateMachine({ currentMode: 'BUS' }), 'riding_bus');
  assert.equal(resolveTimeyStateMachine({ currentMode: 'SUBWAY' }), 'riding_subway');
  assert.equal(resolveTimeyStateMachine({ nextDepartureMinutes: 2 }), 'transfer');
});
