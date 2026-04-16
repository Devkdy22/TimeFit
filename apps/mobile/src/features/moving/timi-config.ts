import type { UiStatus } from '../../theme/status-config';
import type { TimiEmotion, TimiVariant } from '../../components/timi';
import type { TimiMovement } from '../../components/timi/motion-presets';

export interface TimiState {
  variant: TimiVariant;
  movement: TimiMovement;
  emotion: TimiEmotion;
}

const timiStateByStatus: Record<UiStatus, TimiState> = {
  relaxed: {
    variant: 'mint',
    movement: 'idle',
    emotion: 'happy',
  },
  warning: {
    variant: 'orange',
    movement: 'walk',
    emotion: 'focused',
  },
  urgent: {
    variant: 'red',
    movement: 'run',
    emotion: 'panic',
  },
};

export function resolveTimiState(status: UiStatus): TimiState {
  return timiStateByStatus[status];
}

