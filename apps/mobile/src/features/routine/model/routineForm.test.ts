import { clampRoutineBufferMinutes, parseExcludedDates } from './routineForm';

describe('routine form normalization', () => {
  it('keeps valid unique exception dates and drops malformed values', () => {
    expect(parseExcludedDates('2026-07-21, bad, 2026-07-21, 2026-12-01, 2026-02-30')).toEqual([
      '2026-07-21',
      '2026-12-01',
    ]);
  });

  it('clamps routine buffer minutes to the API contract', () => {
    expect(clampRoutineBufferMinutes('-5')).toBe(0);
    expect(clampRoutineBufferMinutes('240')).toBe(120);
    expect(clampRoutineBufferMinutes('not-a-number')).toBe(0);
  });
});
