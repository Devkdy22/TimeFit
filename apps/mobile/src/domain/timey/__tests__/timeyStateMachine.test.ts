import { resolveTimeyStateMachine } from '../timeyStateMachine';

test('arrived has highest priority', () => {
  const state = resolveTimeyStateMachine({ tripStatus: 'ARRIVED', isOffRoute: true, delayRiskLevel: 'HIGH' });
  expect(state).toBe('success');
});

test('priority chain and mode states', () => {
  expect(resolveTimeyStateMachine({ isOffRoute: true })).toBe('offroute');
  expect(resolveTimeyStateMachine({ isRerouting: true })).toBe('rerouting');
  expect(resolveTimeyStateMachine({ isOffRoute: true, isRerouting: true })).toBe('rerouting');
  expect(resolveTimeyStateMachine({ delayRiskLevel: 'HIGH' })).toBe('panic');
  expect(resolveTimeyStateMachine({ bufferMinutes: -5 })).toBe('urgent');
  expect(resolveTimeyStateMachine({ bufferMinutes: 0 })).toBe('urgent');
  expect(resolveTimeyStateMachine({ bufferMinutes: 1 })).toBe('warning');
  expect(resolveTimeyStateMachine({ bufferMinutes: 3 })).toBe('warning');
  expect(resolveTimeyStateMachine({ bufferMinutes: 4 })).toBe('idle');
  expect(resolveTimeyStateMachine({ bufferMinutes: 5 })).toBe('idle');
  expect(resolveTimeyStateMachine({ bufferMinutes: 10 })).toBe('confident');
  expect(resolveTimeyStateMachine({ isSearching: true })).toBe('searching');
  expect(resolveTimeyStateMachine({ currentMode: 'WALK' })).toBe('walking');
  expect(resolveTimeyStateMachine({ currentMode: 'BUS' })).toBe('riding_bus');
  expect(resolveTimeyStateMachine({ currentMode: 'SUBWAY' })).toBe('riding_subway');
  expect(resolveTimeyStateMachine({ nextDepartureMinutes: 2 })).toBe('transfer');
  expect(resolveTimeyStateMachine({ isTransfer: true, currentMode: 'WALK' })).toBe('transfer');
});
