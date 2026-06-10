import { Easing } from 'react-native-reanimated';

export const timeyMotion = {
  idleFloat: {
    translateY: { from: 0, to: -4 },
    duration: 2200,
    easing: Easing.inOut(Easing.cubic),
  },
  blink: {
    minIntervalMs: 2500,
    maxIntervalMs: 4500,
  },
  pressBounce: {
    scale: [1, 0.96, 1] as const,
    duration: 180,
  },
  warningShake: {
    rotationDeg: { from: -2, to: 2 },
  },
  urgentPulse: {
    scale: { from: 1, to: 1.05 },
  },
  lateSweat: {
    bounceY: { from: 0, to: -2 },
  },
  successBounce: {
    scale: [1, 1.06, 1] as const,
  },
  running: {
    translateX: { from: -1.5, to: 1.5 },
  },
  spring: {
    damping: 14,
    stiffness: 120,
  },
} as const;
