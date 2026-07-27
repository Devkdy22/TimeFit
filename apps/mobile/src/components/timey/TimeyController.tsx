import { advanceStableTimeySnapshot } from '../../domain/timey/timeyTransitionGuard';
import { resolveTimeyStateMachine } from '../../domain/timey/timeyStateMachine';
import type { TimeyControllerInput, TimeyState } from '../../types/timey.types';

export function resolveTimeyState(context: TimeyControllerInput): TimeyState {
  return resolveTimeyStateMachine(context);
}

export function resolveStableTimeyState(previous: { state: TimeyState; changedAtMs: number } | null, context: TimeyControllerInput, nowMs: number) {
  const next = resolveTimeyStateMachine(context);
  return advanceStableTimeySnapshot(previous, next, nowMs, context);
}

export function getTimeyAccessibilityLabel(state: TimeyState): string {
  const labels: Record<TimeyState, string> = {
    idle: '타임이가 쉬고 있어요',
    searching: '경로를 찾고 있어요',
    confident: '여유롭게 이동할 수 있어요',
    waiting: '출발을 기다리고 있어요',
    walking: '걸어서 이동하고 있어요',
    riding_bus: '버스를 타고 이동하고 있어요',
    riding_subway: '지하철을 타고 이동하고 있어요',
    transfer: '환승하고 있어요',
    warning: '조금 서둘러야 해요',
    urgent: '지금 출발해야 해요',
    panic: '많이 지연되고 있어요',
    offroute: '경로를 벗어났어요',
    rerouting: '새 경로를 찾고 있어요',
    success: '도착했어요',
    late: '지연되고 있어요',
  };
  return labels[state];
}
