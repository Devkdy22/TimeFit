import { useEffect } from 'react';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CHARACTER_SPRING_CONFIG, clamp } from '../utils/physics';
import type { CharacterGestureValues } from './useCharacterGesture';

export type CharacterState = 'idle' | 'walk' | 'run' | 'urgent' | 'happy' | 'stressed';
type AnimatedNumber = { value: number };

export interface CharacterAnimationValues {
  characterX: AnimatedNumber;
  characterY: AnimatedNumber;
  characterRotationDeg: AnimatedNumber;
  bodyScaleX: AnimatedNumber;
  bodyScaleY: AnimatedNumber;
  bodyOffsetY: AnimatedNumber;
  headRotationDeg: AnimatedNumber;
  leftArmRotationDeg: AnimatedNumber;
  rightArmRotationDeg: AnimatedNumber;
  leftLegRotationDeg: AnimatedNumber;
  rightLegRotationDeg: AnimatedNumber;
  eyeOffsetX: AnimatedNumber;
  eyeOffsetY: AnimatedNumber;
  eyeScaleY: AnimatedNumber;
  leftEyebrowRotationDeg: AnimatedNumber;
  rightEyebrowRotationDeg: AnimatedNumber;
  mouthNeutralOpacity: AnimatedNumber;
  mouthSmileOpacity: AnimatedNumber;
  mouthStressedOpacity: AnimatedNumber;
  mouthSurprisedOpacity: AnimatedNumber;
}

const STATE_INDEX: Record<CharacterState, number> = {
  idle: 0,
  walk: 1,
  run: 2,
  urgent: 3,
  happy: 4,
  stressed: 5,
};

interface UseCharacterAnimationParams {
  state: CharacterState;
  centerX: number;
  centerY: number;
  gesture: CharacterGestureValues;
}

export function useCharacterAnimation({
  state,
  centerX,
  centerY,
  gesture,
}: UseCharacterAnimationParams): CharacterAnimationValues {
  const stateIndex = useSharedValue<number>(STATE_INDEX[state]);
  const phase = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    stateIndex.value = STATE_INDEX[state];
  }, [state, stateIndex]);

  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.12, { duration: 90 }),
        withTiming(1, { duration: 90 }),
      ),
      -1,
      false,
    );
  }, [blink]);

  useFrameCallback(({ timeSincePreviousFrame }) => {
    const delta = timeSincePreviousFrame ?? 16;
    phase.value += (delta / 1000) * 2.4;
    if (phase.value > Math.PI * 4) {
      phase.value -= Math.PI * 4;
    }
  });

  const speed = useDerivedValue(() => {
    const vx = gesture.velocityX.value;
    const vy = gesture.velocityY.value;
    return Math.sqrt(vx * vx + vy * vy);
  });

  const stateBounce = useDerivedValue(() => {
    const wave = Math.sin(phase.value);
    if (stateIndex.value === 2) {
      return wave * 10;
    }
    if (stateIndex.value === 1) {
      return wave * 5;
    }
    if (stateIndex.value === 3) {
      return wave * 1.4;
    }
    return 0;
  });

  const characterX = useDerivedValue(() => gesture.currentX.value - centerX);
  const characterY = useDerivedValue(() => gesture.currentY.value - centerY + stateBounce.value);
  const characterRotationDeg = useDerivedValue(() => clamp(gesture.velocityX.value * 0.05, -12, 12));

  const bodyScaleX = useDerivedValue(() => {
    const base = 1 + speed.value * 0.0008;
    if (gesture.isPressed.value) {
      return clamp(base + 0.06, 0.9, 1.28);
    }
    return clamp(base, 0.92, 1.2);
  });

  const bodyScaleY = useDerivedValue(() => {
    const base = 1 + speed.value * 0.0005;
    if (gesture.isPressed.value) {
      return clamp(base - 0.08, 0.78, 1.12);
    }
    return clamp(base, 0.9, 1.18);
  });

  const bodyOffsetY = useDerivedValue(() => {
    if (stateIndex.value === 2) {
      return Math.sin(phase.value) * 2.8;
    }
    if (stateIndex.value === 1) {
      return Math.sin(phase.value) * 1.6;
    }
    return 0;
  });

  const headRotationDeg = useDerivedValue(() => clamp(gesture.velocityX.value * 0.025, -8, 8));

  const leftArmRotationDeg = useDerivedValue(() => {
    if (stateIndex.value === 2) {
      return -26 + Math.sin(phase.value * 2) * 20;
    }
    if (stateIndex.value === 1) {
      return -18 + Math.sin(phase.value * 1.5) * 12;
    }
    if (stateIndex.value === 3) {
      return -16 + Math.sin(phase.value * 6) * 8;
    }
    return -8;
  });

  const rightArmRotationDeg = useDerivedValue(() => -leftArmRotationDeg.value);

  const leftLegRotationDeg = useDerivedValue(() => {
    if (stateIndex.value === 2) {
      return 10 + Math.sin(phase.value * 2) * 18;
    }
    if (stateIndex.value === 1) {
      return 6 + Math.sin(phase.value * 1.5) * 10;
    }
    return 2;
  });

  const rightLegRotationDeg = useDerivedValue(() => -leftLegRotationDeg.value);

  const eyeOffsetX = useDerivedValue(() => clamp((gesture.touchX.value - centerX) * 0.05, -2.2, 2.2));
  const eyeOffsetY = useDerivedValue(() => clamp((gesture.touchY.value - centerY) * 0.05, -1.8, 1.8));
  const eyeScaleY = useDerivedValue(() => {
    if (stateIndex.value === 3) {
      return 1.14;
    }
    return blink.value;
  });

  const leftEyebrowRotationDeg = useDerivedValue(() => {
    if (stateIndex.value === 5) {
      return -14;
    }
    if (stateIndex.value === 3 || gesture.isPressed.value) {
      return -8;
    }
    return -2;
  });

  const rightEyebrowRotationDeg = useDerivedValue(() => -leftEyebrowRotationDeg.value);

  const mouthNeutralOpacity = useDerivedValue(() =>
    stateIndex.value === 0 || stateIndex.value === 1 || stateIndex.value === 2 ? 1 : 0,
  );
  const mouthSmileOpacity = useDerivedValue(() => (stateIndex.value === 4 ? 1 : 0));
  const mouthStressedOpacity = useDerivedValue(() => (stateIndex.value === 5 ? 1 : 0));
  const mouthSurprisedOpacity = useDerivedValue(() =>
    stateIndex.value === 3 || gesture.isPressed.value ? 1 : 0,
  );

  useEffect(() => {
    gesture.targetX.value = withSpring(centerX, CHARACTER_SPRING_CONFIG);
    gesture.targetY.value = withSpring(centerY, CHARACTER_SPRING_CONFIG);
  }, [centerX, centerY, gesture.targetX, gesture.targetY]);

  return {
    characterX,
    characterY,
    characterRotationDeg,
    bodyScaleX,
    bodyScaleY,
    bodyOffsetY,
    headRotationDeg,
    leftArmRotationDeg,
    rightArmRotationDeg,
    leftLegRotationDeg,
    rightLegRotationDeg,
    eyeOffsetX,
    eyeOffsetY,
    eyeScaleY,
    leftEyebrowRotationDeg,
    rightEyebrowRotationDeg,
    mouthNeutralOpacity,
    mouthSmileOpacity,
    mouthStressedOpacity,
    mouthSurprisedOpacity,
  };
}
