import type { TimeyContext, TimeyState } from '../domain/timey/timeyTypes';
export type { TimeyContext, TimeyState } from '../domain/timey/timeyTypes';

export type TimeySize = 'sm' | 'md' | 'lg' | number;

export type TimeyAnimationMode = 'static' | 'rive' | 'auto';
export type TimeyRenderStyle = 'flat' | 'soft3d';

export type TimeyProps = {
  state?: TimeyState;
  size?: TimeySize;
  animated?: boolean;
  animationMode?: TimeyAnimationMode;
  renderStyle?: TimeyRenderStyle;
  riveUrgency?: number;
  riveIsMoving?: boolean;
  riveDebugTriggerType?: 'success' | 'rerouting' | 'offroute';
  riveDebugTriggerNonce?: number;
  glow?: boolean;
  accessibilityLabel?: string;
};

export type TimeyControllerInput = TimeyContext;
