import type { TimeyState } from '../../domain/timey/timeyTypes';

export type TimeyStageVariant = 'home' | 'routine' | 'route' | 'moving' | 'map' | 'success' | 'warning';

export interface TimeyStageToken {
  aspectRatio: number;
  minHeight: number;
  maxHeight: number;
  minSize: number;
  maxSize: number;
  sizeRatio: number;
  horizontalPadding: number;
  baselineOffset: number;
}

/** Shared layout tokens. Individual screens choose a context, not arbitrary dimensions. */
export const TIMEY_STAGE_TOKENS: Record<TimeyStageVariant, TimeyStageToken> = {
  home: {
    aspectRatio: 1.55,
    minHeight: 112,
    maxHeight: 188,
    minSize: 96,
    maxSize: 144,
    sizeRatio: 0.82,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
  routine: {
    aspectRatio: 2.2,
    minHeight: 76,
    maxHeight: 116,
    minSize: 68,
    maxSize: 98,
    sizeRatio: 0.7,
    horizontalPadding: 8,
    baselineOffset: 3,
  },
  route: {
    aspectRatio: 1.65,
    minHeight: 96,
    maxHeight: 152,
    minSize: 86,
    maxSize: 128,
    sizeRatio: 0.8,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
  moving: {
    aspectRatio: 1.75,
    minHeight: 82,
    maxHeight: 142,
    minSize: 76,
    maxSize: 116,
    sizeRatio: 0.74,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
  map: {
    aspectRatio: 1.9,
    minHeight: 78,
    maxHeight: 128,
    minSize: 72,
    maxSize: 110,
    sizeRatio: 0.72,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
  success: {
    aspectRatio: 1.45,
    minHeight: 112,
    maxHeight: 176,
    minSize: 94,
    maxSize: 136,
    sizeRatio: 0.8,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
  warning: {
    aspectRatio: 1.65,
    minHeight: 96,
    maxHeight: 152,
    minSize: 88,
    maxSize: 128,
    sizeRatio: 0.82,
    horizontalPadding: 8,
    baselineOffset: 4,
  },
};

export interface TimeyStageMetrics {
  width: number;
  height: number;
  size: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveTimeyStageMetrics(
  availableWidth: number,
  variant: TimeyStageVariant,
): TimeyStageMetrics {
  const token = TIMEY_STAGE_TOKENS[variant];
  const width = Math.max(1, availableWidth - token.horizontalPadding * 2);
  const height = clamp(width / token.aspectRatio, token.minHeight, token.maxHeight);
  const size = clamp(width * token.sizeRatio, token.minSize, token.maxSize);
  return { width, height, size };
}

export interface TimeyMotionProfile {
  pattern: 'breathing' | 'scan' | 'walk' | 'bus' | 'subway' | 'transfer' | 'alert' | 'reroute' | 'offroute' | 'success';
  cycleMs: number;
  translateX: number;
  translateY: number;
  rotateDeg: number;
  scale: number;
  breathing: number;
  oneShot?: boolean;
}

export type TimeyMotionAxis = 'x' | 'y' | 'rotate';

export const TIMEY_MOTION_KEYFRAMES: Record<TimeyMotionProfile['pattern'], Record<TimeyMotionAxis, readonly number[]>> = {
  breathing: { x: [0, 0.3, 0, -0.3, 0], y: [0, -1, 0, -1, 0], rotate: [0, 0.5, 0, -0.5, 0] },
  scan: { x: [-1, 0.25, 1, -0.35, -1], y: [0, -0.2, 0, -0.2, 0], rotate: [-0.5, 0.4, 0.7, -0.4, -0.5] },
  walk: { x: [0, 0.7, 0, -0.7, 0], y: [1, -1, 1, -1, 1], rotate: [0, -0.5, 0.5, -0.5, 0] },
  bus: { x: [-0.4, 0.7, -0.2, 0.5, -0.4], y: [0.2, -0.8, 0.5, -0.3, 0.2], rotate: [-0.4, 0.8, -0.2, 0.6, -0.4] },
  subway: { x: [0, 0.25, 0, -0.25, 0], y: [0.6, -0.4, 0.2, -0.2, 0.6], rotate: [0, 0.2, 0, -0.2, 0] },
  transfer: { x: [-0.2, -0.2, 0.1, 0.7, 0], y: [0, 0.1, 0, -0.1, 0], rotate: [-0.8, -0.8, 0, 1, 0] },
  alert: { x: [0, 0.2, 0, -0.15, 0], y: [0.3, -0.5, 0.2, -0.1, 0.3], rotate: [0, -0.6, 0.3, -0.2, 0] },
  reroute: { x: [-0.5, -0.2, 0.5, 0.8, 0], y: [0, -0.2, 0, -0.2, 0], rotate: [-0.8, -0.3, 0.7, 1, 0] },
  offroute: { x: [-0.3, 0.4, -0.25, 0.2, 0], y: [0, 0.1, 0.25, 0.1, 0], rotate: [0, 0.35, -0.25, 0.15, 0] },
  success: { x: [0, 0.2, 0, -0.1, 0], y: [1, -1, 0.5, -0.2, 0], rotate: [0, 0.5, 0, -0.3, 0] },
};

export function getTimeyMotionKeyframes(pattern: TimeyMotionProfile['pattern'], axis: TimeyMotionAxis) {
  return TIMEY_MOTION_KEYFRAMES[pattern][axis];
}

/** Motion is state-driven and intentionally small; the Stage owns position and baseline. */
export const TIMEY_MOTION_PROFILES: Record<TimeyState, TimeyMotionProfile> = {
  idle: { pattern: 'breathing', cycleMs: 2800, translateX: 0.7, translateY: 1.2, rotateDeg: 0.35, scale: 0, breathing: 0.008 },
  searching: { pattern: 'scan', cycleMs: 1500, translateX: 1.8, translateY: 0.4, rotateDeg: 1.2, scale: 0.004, breathing: 0.006 },
  confident: { pattern: 'breathing', cycleMs: 3000, translateX: 0.5, translateY: 0.8, rotateDeg: 0.25, scale: 0, breathing: 0.007 },
  waiting: { pattern: 'breathing', cycleMs: 3200, translateX: 0.35, translateY: 0.6, rotateDeg: 0.2, scale: 0, breathing: 0.005 },
  walking: { pattern: 'walk', cycleMs: 620, translateX: 0.8, translateY: 2.8, rotateDeg: 1.2, scale: 0.004, breathing: 0 },
  riding_bus: { pattern: 'bus', cycleMs: 760, translateX: 1.6, translateY: 1.7, rotateDeg: 1.8, scale: 0.003, breathing: 0 },
  riding_subway: { pattern: 'subway', cycleMs: 920, translateX: 0.5, translateY: 1.1, rotateDeg: 0.9, scale: 0.002, breathing: 0 },
  transfer: { pattern: 'transfer', cycleMs: 1100, translateX: 1.2, translateY: 0.4, rotateDeg: 2.2, scale: 0.003, breathing: 0 },
  warning: { pattern: 'alert', cycleMs: 1250, translateX: 0.5, translateY: 0.2, rotateDeg: 1.1, scale: 0.006, breathing: 0 },
  urgent: { pattern: 'alert', cycleMs: 900, translateX: 0.7, translateY: 0.5, rotateDeg: 1.7, scale: 0.014, breathing: 0 },
  panic: { pattern: 'alert', cycleMs: 760, translateX: 0.8, translateY: 0.3, rotateDeg: 2, scale: 0.018, breathing: 0 },
  offroute: { pattern: 'offroute', cycleMs: 1350, translateX: 1.15, translateY: 0.7, rotateDeg: 0.9, scale: 0.003, breathing: 0 },
  rerouting: { pattern: 'reroute', cycleMs: 1000, translateX: 1.5, translateY: 0.4, rotateDeg: 2.4, scale: 0.005, breathing: 0 },
  success: { pattern: 'success', cycleMs: 720, translateX: 0.4, translateY: 5, rotateDeg: 1.2, scale: 0.035, breathing: 0, oneShot: true },
  late: { pattern: 'alert', cycleMs: 1150, translateX: 0.55, translateY: 0.25, rotateDeg: 1.2, scale: 0.008, breathing: 0 },
};

export function getTimeyMotionProfile(state: TimeyState): TimeyMotionProfile {
  return TIMEY_MOTION_PROFILES[state] ?? TIMEY_MOTION_PROFILES.idle;
}
