export type TimiMovement = 'idle' | 'walk' | 'run' | 'wave';

export interface MotionPreset {
  translateY: number;
  translateX: number;
  scale: number;
  rotateDeg: number;
  duration: number;
}

export const timiMotionPresets: Record<TimiMovement, MotionPreset> = {
  idle: {
    translateY: 5,
    translateX: 0,
    scale: 1,
    rotateDeg: 0,
    duration: 520,
  },
  walk: {
    translateY: 5,
    translateX: 6,
    scale: 1.03,
    rotateDeg: 0,
    duration: 280,
  },
  run: {
    translateY: 14,
    translateX: 9,
    scale: 1.12,
    rotateDeg: 0,
    duration: 190,
  },
  wave: {
    translateY: 2,
    translateX: 0,
    scale: 1,
    rotateDeg: 15,
    duration: 300,
  },
};
