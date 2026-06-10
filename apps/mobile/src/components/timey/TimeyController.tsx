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
  if (state === 'searching') return '경로를 찾고 있어요';
  if (state === 'warning') return '조금 서둘러야 해요';
  if (state === 'urgent') return '지금 출발해야 해요';
  if (state === 'offroute') return '경로를 벗어났어요';
  if (state === 'rerouting') return '새 경로를 찾고 있어요';
  if (state === 'success') return '도착했어요';
  return '타임이 캐릭터';
}
