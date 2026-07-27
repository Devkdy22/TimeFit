import { canRunTimeyGreeting, TIMEY_GREETING_PROGRESS, TIMEY_GREETING_ROTATION_DEG, TIMEY_GREETING_TRANSLATE_Y } from './timeyGreeting';

describe('Timey greeting eligibility and motion', () => {
  it('allows greeting only for Home idle-like states', () => {
    expect(canRunTimeyGreeting('idle')).toBe(true);
    expect(canRunTimeyGreeting('confident')).toBe(true);
    expect(canRunTimeyGreeting('waiting')).toBe(true);
    expect(canRunTimeyGreeting('searching')).toBe(false);
    expect(canRunTimeyGreeting('walking')).toBe(false);
    expect(canRunTimeyGreeting('warning')).toBe(false);
    expect(canRunTimeyGreeting('urgent')).toBe(false);
  });

  it('lifts, waves in small arcs, and returns to the existing arm pose', () => {
    expect(TIMEY_GREETING_PROGRESS).toHaveLength(TIMEY_GREETING_ROTATION_DEG.length);
    expect(TIMEY_GREETING_PROGRESS).toHaveLength(TIMEY_GREETING_TRANSLATE_Y.length);
    expect(TIMEY_GREETING_ROTATION_DEG[0]).toBe(8);
    expect(TIMEY_GREETING_ROTATION_DEG.at(-1)).toBe(8);
    expect(TIMEY_GREETING_TRANSLATE_Y[1]).toBeLessThan(0);
    expect(TIMEY_GREETING_TRANSLATE_Y.at(-1)).toBe(0);
  });
});
