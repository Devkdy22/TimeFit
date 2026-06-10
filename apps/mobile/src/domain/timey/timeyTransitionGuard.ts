import { timeyThresholds } from './timeyThresholds';
import type { TimeyContext, TimeyState, TimeyTransitionSnapshot } from './timeyTypes';

const HOLD_STATES: Partial<Record<TimeyState, number>> = {
  panic: timeyThresholds.panicMinHoldMs,
  rerouting: timeyThresholds.reroutingMinHoldMs,
  offroute: timeyThresholds.offrouteMinHoldMs,
};

function shouldKeepHeldState(prev: TimeyState, elapsedMs: number) {
  const minHold = HOLD_STATES[prev];
  if (!minHold) return false;
  return elapsedMs < minHold;
}

function shouldKeepWarning(prev: TimeyState, next: TimeyState, context: TimeyContext | undefined) {
  if (prev !== 'warning' || next === 'warning') return false;
  const buffer = context?.bufferMinutes;
  if (typeof buffer !== 'number') return false;
  return buffer < timeyThresholds.warningExitBufferMinutes;
}

function shouldKeepUrgent(prev: TimeyState, next: TimeyState, context: TimeyContext | undefined) {
  if (prev !== 'urgent' || next === 'urgent') return false;
  const buffer = context?.bufferMinutes;
  if (typeof buffer !== 'number') return false;
  return buffer < timeyThresholds.urgentExitBufferMinutes;
}

export function getStableTimeyState(
  prevState: TimeyState,
  nextState: TimeyState,
  timestampMs: number,
  context?: TimeyContext,
  prevChangedAtMs?: number,
): TimeyState {
  if (prevState === nextState) return prevState;

  if (
    prevChangedAtMs != null &&
    Number.isFinite(prevChangedAtMs) &&
    shouldKeepHeldState(prevState, Math.max(0, timestampMs - prevChangedAtMs))
  ) {
    return prevState;
  }

  if (shouldKeepUrgent(prevState, nextState, context)) return prevState;
  if (shouldKeepWarning(prevState, nextState, context)) return prevState;

  return nextState;
}

export function advanceStableTimeySnapshot(
  previous: TimeyTransitionSnapshot | null,
  nextState: TimeyState,
  nowMs: number,
  context?: TimeyContext,
): TimeyTransitionSnapshot {
  if (!previous) {
    return { state: nextState, changedAtMs: nowMs };
  }

  const stable = getStableTimeyState(previous.state, nextState, nowMs, context, previous.changedAtMs);
  if (stable === previous.state) {
    return previous;
  }

  return { state: stable, changedAtMs: nowMs };
}
