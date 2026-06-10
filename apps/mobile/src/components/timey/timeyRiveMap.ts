import type { TimeyState } from '../../types/timey.types';

export const TIMEY_RIVE_STATE_NUMBER_MAP: Record<TimeyState, number> = {
  idle: 0,
  searching: 1,
  confident: 2,
  waiting: 3,
  walking: 4,
  riding_bus: 5,
  riding_subway: 6,
  transfer: 7,
  warning: 8,
  urgent: 9,
  panic: 10,
  offroute: 11,
  rerouting: 12,
  success: 13,
  late: 14,
};

export const TIMEY_RIVE_TRIGGER_STATES = {
  success: 'triggerSuccess',
  rerouting: 'triggerReroute',
  offroute: 'triggerOffroute',
} as const;

export function toTimeyRiveStateNumber(state: TimeyState): number {
  return TIMEY_RIVE_STATE_NUMBER_MAP[state] ?? 0;
}

export function inferTimeyRiveIsMoving(state: TimeyState): boolean {
  return state === 'walking' || state === 'riding_bus' || state === 'riding_subway' || state === 'transfer';
}

export function inferTimeyRiveUrgency(state: TimeyState, value?: number): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.min(1, value));
  }
  if (state === 'panic') return 1;
  if (state === 'urgent' || state === 'offroute') return 0.9;
  if (state === 'warning' || state === 'rerouting' || state === 'late') return 0.65;
  return 0.2;
}
