export function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

export function lerp(current: number, target: number, alpha: number) {
  'worklet';
  return current + (target - current) * alpha;
}

export function dampVelocity(velocity: number, factor: number) {
  'worklet';
  return velocity * factor;
}

export const CHARACTER_SPRING_CONFIG = {
  damping: 12,
  stiffness: 120,
} as const;

