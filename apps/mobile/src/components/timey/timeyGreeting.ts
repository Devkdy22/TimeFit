import type { TimeyState } from '../../domain/timey/timeyTypes';

/** Home-only states that are allowed to run the one-shot greeting. */
export const TIMEY_GREETING_STATES: readonly TimeyState[] = ['idle', 'confident', 'waiting'];

/**
 * Progress points for the right-arm greeting. The first point lifts the arm;
 * the middle points make three small, restrained waves; the last point rests.
 */
export const TIMEY_GREETING_PROGRESS = [0, 0.2, 0.36, 0.52, 0.68, 0.82, 1] as const;
export const TIMEY_GREETING_ROTATION_DEG = [8, -12, -20, -10, -18, -11, 8] as const;
export const TIMEY_GREETING_TRANSLATE_Y = [0, -2.5, -3.5, -2.5, -3.2, -2, 0] as const;
export const TIMEY_GREETING_DURATION_MS = 880;

export function canRunTimeyGreeting(state: TimeyState): boolean {
  return TIMEY_GREETING_STATES.includes(state);
}
