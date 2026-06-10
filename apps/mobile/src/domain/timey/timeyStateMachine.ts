import type { TimeyContext, TimeyState } from './timeyTypes';

export function resolveTimeyStateMachine(context: TimeyContext): TimeyState {
  if (context.tripStatus === 'ARRIVED') return 'success';
  if (context.isOffRoute === true) return 'offroute';
  if (context.isRerouting === true) return 'rerouting';
  if (context.delayRiskLevel === 'HIGH') return 'panic';

  if (typeof context.delayMinutes === 'number' && context.delayMinutes > 0) {
    return 'late';
  }

  if (typeof context.bufferMinutes === 'number' && context.bufferMinutes <= 0) return 'urgent';
  if (typeof context.bufferMinutes === 'number' && context.bufferMinutes <= 3) return 'warning';

  if (context.isSearching) return 'searching';

  if (context.currentMode === 'WALK') return 'walking';
  if (context.currentMode === 'BUS') return 'riding_bus';
  if (context.currentMode === 'SUBWAY') return 'riding_subway';

  if (context.nextDepartureMinutes != null && context.nextDepartureMinutes <= 2) return 'transfer';

  if (typeof context.bufferMinutes === 'number' && context.bufferMinutes >= 10) return 'confident';

  return 'idle';
}
