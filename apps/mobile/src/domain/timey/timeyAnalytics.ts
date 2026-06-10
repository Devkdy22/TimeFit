import type { TimeyState } from './timeyTypes';

const seenShown = new Set<string>();
const seenChanged = new Set<string>();

type TimeyAnalyticsEvent =
  | 'timey_state_shown'
  | 'timey_state_changed'
  | 'timey_reroute_visible'
  | 'timey_offroute_visible';

function emit(event: TimeyAnalyticsEvent, payload: Record<string, string>) {
  console.info('[TimeyAnalytics]', event, payload);
}

export function trackTimeyStateShown(screen: string, state: TimeyState) {
  const key = `${screen}:${state}`;
  if (seenShown.has(key)) return;
  seenShown.add(key);
  emit('timey_state_shown', { screen, state });
}

export function trackTimeyStateChanged(screen: string, prevState: TimeyState, nextState: TimeyState) {
  const key = `${screen}:${prevState}->${nextState}`;
  if (seenChanged.has(key)) return;
  seenChanged.add(key);
  emit('timey_state_changed', { screen, prevState, nextState });

  if (nextState === 'rerouting') {
    emit('timey_reroute_visible', { screen });
  }
  if (nextState === 'offroute') {
    emit('timey_offroute_visible', { screen });
  }
}
