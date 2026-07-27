import type { TimeyState } from '../timeyTypes';
import {
  inferTimeyRiveIsMoving,
  inferTimeyRiveUrgency,
  toTimeyRiveStateNumber,
} from '../../../components/timey/timeyRiveMap';

const requiredStates: TimeyState[] = [
  'idle',
  'searching',
  'walking',
  'riding_bus',
  'riding_subway',
  'transfer',
  'warning',
  'urgent',
  'rerouting',
  'offroute',
  'success',
];

describe('Timey Rive state contract', () => {
  it('maps every required state to a stable, distinct state number', () => {
    const numbers = requiredStates.map(toTimeyRiveStateNumber);

    expect(numbers.every((number) => Number.isInteger(number) && number >= 0)).toBe(true);
    expect(new Set(numbers).size).toBe(requiredStates.length);
  });

  it('marks walking and riding states as moving', () => {
    expect(inferTimeyRiveIsMoving('walking')).toBe(true);
    expect(inferTimeyRiveIsMoving('riding_bus')).toBe(true);
    expect(inferTimeyRiveIsMoving('riding_subway')).toBe(true);
    expect(inferTimeyRiveIsMoving('transfer')).toBe(true);
    expect(inferTimeyRiveIsMoving('idle')).toBe(false);
    expect(inferTimeyRiveIsMoving('success')).toBe(false);
  });

  it('keeps urgency within the state-machine input range', () => {
    for (const state of requiredStates) {
      expect(inferTimeyRiveUrgency(state)).toBeGreaterThanOrEqual(0);
      expect(inferTimeyRiveUrgency(state)).toBeLessThanOrEqual(1);
    }
    expect(inferTimeyRiveUrgency('urgent')).toBeGreaterThan(inferTimeyRiveUrgency('warning'));
    expect(inferTimeyRiveUrgency('offroute')).toBeGreaterThan(inferTimeyRiveUrgency('idle'));
  });
});
