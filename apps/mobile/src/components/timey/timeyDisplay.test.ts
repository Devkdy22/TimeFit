import { TIMEY_MOTION_PROFILES, TIMEY_STAGE_TOKENS, getTimeyMotionProfile, resolveTimeyStageMetrics } from './timeyDisplay';
import { getTimeyStatusOverlay } from './timeyOverlay';
import { TIMEY_3D_BLINK_MODE } from './timeyBlink';

describe('Timey display tokens', () => {
  it('keeps stage metrics within context bounds across phone widths', () => {
    for (const variant of Object.keys(TIMEY_STAGE_TOKENS) as Array<keyof typeof TIMEY_STAGE_TOKENS>) {
      const token = TIMEY_STAGE_TOKENS[variant];
      const narrow = resolveTimeyStageMetrics(320, variant);
      const wide = resolveTimeyStageMetrics(1440, variant);

      expect(narrow.height).toBeGreaterThanOrEqual(token.minHeight);
      expect(narrow.height).toBeLessThanOrEqual(token.maxHeight);
      expect(wide.height).toBeGreaterThanOrEqual(token.minHeight);
      expect(wide.height).toBeLessThanOrEqual(token.maxHeight);
      expect(narrow.size).toBeGreaterThanOrEqual(token.minSize);
      expect(narrow.size).toBeLessThanOrEqual(token.maxSize);
      expect(wide.size).toBeGreaterThanOrEqual(token.minSize);
      expect(wide.size).toBeLessThanOrEqual(token.maxSize);
    }
  });

  it('uses a shared motion profile for every state without large idle floating', () => {
    const states = Object.keys(TIMEY_MOTION_PROFILES) as Array<keyof typeof TIMEY_MOTION_PROFILES>;
    expect(states).toHaveLength(15);
    expect(getTimeyMotionProfile('idle').translateY).toBeLessThanOrEqual(1.2);
    expect(getTimeyMotionProfile('success').oneShot).toBe(true);
    expect(getTimeyMotionProfile('riding_bus').translateX).toBeGreaterThan(getTimeyMotionProfile('riding_subway').translateX);
    expect(getTimeyMotionProfile('warning').rotateDeg).toBeLessThan(3);
    expect(getTimeyMotionProfile('walking').pattern).toBe('walk');
    expect(getTimeyMotionProfile('riding_bus').pattern).toBe('bus');
    expect(getTimeyMotionProfile('riding_subway').pattern).toBe('subway');
    expect(getTimeyMotionProfile('urgent').pattern).toBe('alert');
    expect(getTimeyMotionProfile('offroute').pattern).toBe('offroute');
    expect(getTimeyMotionProfile('success').cycleMs).toBeLessThan(getTimeyMotionProfile('idle').cycleMs);
  });

  it('exposes compact context overlays without replacing the Stage', () => {
    expect(getTimeyStatusOverlay('walking')?.icon).toBe('footsteps-outline');
    expect(getTimeyStatusOverlay('riding_bus')?.icon).toBe('bus-outline');
    expect(getTimeyStatusOverlay('riding_subway')?.icon).toBe('train-outline');
    expect(getTimeyStatusOverlay('warning')?.icon).toBe('alert-circle-outline');
    expect(getTimeyStatusOverlay('urgent')?.icon).toBe('warning-outline');
    expect(getTimeyStatusOverlay('idle')).toBeNull();
    expect(TIMEY_3D_BLINK_MODE).toBe('eyesOpenFallback');
  });
});
