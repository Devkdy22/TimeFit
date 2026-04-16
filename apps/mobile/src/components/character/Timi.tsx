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
}: TimiProps) {
  const transforms: Partial<TimiPartTransforms> = {
    eyesScaleY: blink,
    gazeX,
    headRotateDeg,
    bodyTranslateY,
    leftArmRotateDeg,
    rightArmRotateDeg,
  };

  return <TimiBase tone={tone} size={size} expression={expression} transforms={transforms} />;
}
