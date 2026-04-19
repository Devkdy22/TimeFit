import { TimiBase } from './TimiBase';
import type { TimiExpression, TimiPartTransforms } from './TimiModel';

export type TimiTone = 'mint' | 'orange' | 'red';

export interface TimiProps {
  tone?: TimiTone;
  size?: number;
  blink?: number;
  gazeX?: number;
  expression?: TimiExpression;
  headRotateDeg?: number;
  bodyTranslateY?: number;
  leftArmRotateDeg?: number;
  rightArmRotateDeg?: number;
  rightArmTranslateY?: number;
  facePullX?: number;
  facePullY?: number;
  faceDepth?: number;
  faceFocusX?: number;
  faceFocusY?: number;
  showShadow?: boolean;
}

export function Timi({
  tone = 'mint',
  size = 56,
  blink = 1,
  gazeX = 0,
  expression = 'neutral',
  headRotateDeg = 0,
  bodyTranslateY = 0,
  leftArmRotateDeg = -8,
  rightArmRotateDeg = 8,
  rightArmTranslateY = 0,
  facePullX = 0,
  facePullY = 0,
  faceDepth = 0,
  faceFocusX = 0,
  faceFocusY = 0,
  showShadow = true,
}: TimiProps) {
  const transforms: Partial<TimiPartTransforms> = {
    eyesScaleY: blink,
    gazeX,
    headRotateDeg,
    bodyTranslateY,
    leftArmRotateDeg,
    rightArmRotateDeg,
    rightArmTranslateY,
  };

  return (
    <TimiBase
      tone={tone}
      size={size}
      expression={expression}
      transforms={transforms}
      facePullX={facePullX}
      facePullY={facePullY}
      faceDepth={faceDepth}
      faceFocusX={faceFocusX}
      faceFocusY={faceFocusY}
      showShadow={showShadow}
    />
  );
}
