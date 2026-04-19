export type TimiExpression = 'neutral' | 'question' | 'focus' | 'smile' | 'concerned';

export type TimiPartId = 'head' | 'eyes' | 'mouth' | 'body' | 'leftArm' | 'rightArm';

export interface TimiPartTransforms {
  headRotateDeg: number;
  eyesScaleY: number;
  bodyTranslateY: number;
  leftArmRotateDeg: number;
  rightArmRotateDeg: number;
  rightArmTranslateY: number;
  gazeX: number;
}

export const TIMI_PART_DEFAULT_TRANSFORMS: TimiPartTransforms = {
  headRotateDeg: 0,
  eyesScaleY: 1,
  bodyTranslateY: 0,
  leftArmRotateDeg: -8,
  rightArmRotateDeg: 8,
  rightArmTranslateY: 0,
  gazeX: 0,
};

export const TIMI_TRANSFORM_ORIGIN = {
  head: { x: 60, y: 58 },
  eyes: { x: 60, y: 46 },
  leftArm: { x: 42, y: 74 },
  rightArm: { x: 78, y: 74 },
} as const;
