import { Animated } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import type { TimiTone } from './Timi';
import {
  TIMI_PART_DEFAULT_TRANSFORMS,
  TIMI_TRANSFORM_ORIGIN,
  type TimiExpression,
  type TimiPartTransforms,
} from './TimiModel';

export const AnimatedG = Animated.createAnimatedComponent(G);

interface TimiPalette {
  body: string;
  inner: string;
  stroke: string;
}

const PALETTE_BY_TONE: Record<TimiTone, TimiPalette> = {
  mint: {
    body: '#6ED6CD',
    inner: '#eefdfc',
    stroke: '#6ED6CD',
  },
  orange: {
    body: '#FCB451',
    inner: '#FFF2E8',
    stroke: '#FCB451',
  },
  red: {
    body: '#D26767',
    inner: '#FFEAEA',
    stroke: '#D26767',
  },
};

export interface TimiBaseProps {
  tone?: TimiTone;
  size?: number;
  expression?: TimiExpression;
  transforms?: Partial<TimiPartTransforms>;
  facePullX?: number;
  facePullY?: number;
  faceDepth?: number;
  faceFocusX?: number;
  faceFocusY?: number;
  showShadow?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface BlobGeometry {
  path: string;
  x: number;
  y: number;
  rightR: number;
  leftR: number;
  topR: number;
  bottomR: number;
  radiusAt: (angle: number) => number;
}

function buildBlobGeometry(
  cx: number,
  cy: number,
  radius: number,
  pullX: number,
  pullY: number,
  depth: number,
  focusX: number,
  focusY: number,
): BlobGeometry {
  const px = clamp(pullX, -1, 1);
  const py = clamp(pullY, -1, 1);
  const d = clamp(depth, 0, 1);
  const fx = clamp(focusX, -1, 1);
  const fy = clamp(focusY, -1, 1);
  const sx = 0;
  const sy = 0;
  const x = cx + sx;
  const y = cy + sy;
  const pullStrength = clamp(Math.sqrt(px * px + py * py), 0, 1);
  const hasFocus = Math.abs(fx) > 0.02 || Math.abs(fy) > 0.02;
  const focusAngle = hasFocus ? Math.atan2(fy, fx) : Math.atan2(py || 0.0001, px || 1);
  const sigma = 0.22;

  const shortestAngleDiff = (a: number, b: number) => {
    let diff = a - b;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  };

  const radiusAt = (angle: number) => {
    const directional = px * Math.cos(angle) + py * Math.sin(angle);
    const baseWarp = directional * (0.05 + d * 0.05);

    const diff = shortestAngleDiff(angle, focusAngle);
    const local = Math.exp(-(diff * diff) / (2 * sigma * sigma));
    const oppositeDiff = Math.abs(Math.abs(diff) - Math.PI);
    const opposite = Math.exp(
      -(oppositeDiff * oppositeDiff) / (2 * (sigma * 1.75) * (sigma * 1.75)),
    );
    const upwardPull = Math.max(0, -py);
    const topRegion = Math.max(0, -Math.sin(angle));
    const topBoost = upwardPull * topRegion * (0.06 + d * 0.08);
    const localWarp = pullStrength * (0.08 + d * 0.14) * local + topBoost * local;
    const oppositeWarp = pullStrength * (0.03 + d * 0.06) * opposite * (1 - upwardPull * 0.35);

    const warped = radius * (1 + baseWarp + localWarp - oppositeWarp);
    return clamp(warped, radius * 0.84, radius * 1.36);
  };

  const steps = 48;
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r = radiusAt(t);
    points.push({
      x: x + Math.cos(t) * r,
      y: y + Math.sin(t) * r,
    });
  }

  const path = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  const rightR = radiusAt(0);
  const bottomR = radiusAt(Math.PI / 2);
  const leftR = radiusAt(Math.PI);
  const topR = radiusAt(-Math.PI / 2);

  return { path, x, y, rightR, leftR, topR, bottomR, radiusAt };
}

function markerPath(cx: number, cy: number, dx: number, dy: number, length: number) {
  const half = length / 2;
  return `M ${cx - dx * half} ${cy - dy * half} L ${cx + dx * half} ${cy + dy * half}`;
}

function markerCenter(
  geometry: BlobGeometry,
  angle: number,
  inwardInset: number,
): { x: number; y: number } {
  const r = geometry.radiusAt(angle);
  const ox = Math.cos(angle);
  const oy = Math.sin(angle);
  const boundaryX = geometry.x + ox * r;
  const boundaryY = geometry.y + oy * r;
  return {
    x: boundaryX - ox * inwardInset,
    y: boundaryY - oy * inwardInset,
  };
}

function mouthPathByExpression(expression: TimiExpression): string {
  switch (expression) {
    case 'question':
      return 'M50 55 C54 58 66 58 70 55';
    case 'focus':
      return 'M50 55 L70 55';
    case 'smile':
      return 'M50 53 C54 60 66 60 70 53';
    case 'concerned':
      return 'M50 58 C54 52 66 52 70 58';
    case 'neutral':
    default:
      return 'M50 55 C55 56 65 56 70 55';
  }
}

export function BodyPart({ palette, translateY }: { palette: TimiPalette; translateY: number }) {
  return (
    <G id="body" transform={`translate(0 ${translateY})`}>
      <Ellipse
        cx="46"
        cy="89.5"
        rx="6.4"
        ry="7.8"
        transform="rotate(10 46 89.5)"
        fill={palette.body}
      />
      <Ellipse
        cx="74"
        cy="89.5"
        rx="6.4"
        ry="7.8"
        transform="rotate(-10 74 89.5)"
        fill={palette.body}
      />
    </G>
  );
}

export function LeftArmPart({ palette, rotateDeg }: { palette: TimiPalette; rotateDeg: number }) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.leftArm;
  return (
    <G id="leftArm" transform={`rotate(${rotateDeg} ${x} ${y})`}>
      <Ellipse cx="25" cy="55" rx="7.5" ry="5.5" fill={palette.body} />
    </G>
  );
}

export function RightArmPart({
  palette,
  rotateDeg,
  translateY,
}: {
  palette: TimiPalette;
  rotateDeg: number;
  translateY: number;
}) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.rightArm;
  return (
    <G id="rightArm" transform={`translate(0 ${translateY}) rotate(${rotateDeg} ${x} ${y})`}>
      <Ellipse cx="106" cy="55" rx="7.5" ry="5.5" fill={palette.body} />
    </G>
  );
}

export function EyesPart({ eyesScaleY, gazeX }: { eyesScaleY: number; gazeX: number }) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.eyes;
  const clampedScaleY = clamp(eyesScaleY, 0.14, 1.15);
  const clampedGazeX = clamp(gazeX, -2.2, 2.2);
  return (
    <G
      id="eyes"
      transform={`translate(${clampedGazeX} 0) translate(${x} ${y}) scale(1 ${clampedScaleY}) translate(${-x} ${-y})`}
    >
      <Ellipse cx="48" cy="46" rx="3" ry="4" fill="#1F2A44" />
      <Ellipse cx="72" cy="46" rx="3" ry="4" fill="#1F2A44" />
    </G>
  );
}

export function MouthPart({ expression }: { expression: TimiExpression }) {
  return (
    <G id="mouth">
      <Path
        d={mouthPathByExpression(expression)}
        stroke="#1F2A44"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </G>
  );
}

export function HeadPart({
  palette,
  rotateDeg,
  eyesScaleY,
  gazeX,
  expression,
  facePullX,
  facePullY,
  faceDepth,
  faceFocusX,
  faceFocusY,
}: {
  palette: TimiPalette;
  rotateDeg: number;
  eyesScaleY: number;
  gazeX: number;
  expression: TimiExpression;
  facePullX: number;
  facePullY: number;
  faceDepth: number;
  faceFocusX: number;
  faceFocusY: number;
}) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.head;
  const pullX = clamp(facePullX, -1, 1);
  const pullY = clamp(facePullY, -1, 1);
  const depth = clamp(faceDepth, 0, 1);
  const focusX = clamp(faceFocusX, -1, 1);
  const focusY = clamp(faceFocusY, -1, 1);
  const outer = buildBlobGeometry(60, 54, 36, pullX, pullY, depth, focusX, focusY);
  const inner = buildBlobGeometry(60, 54, 32, pullX, pullY, depth, focusX, focusY);

  // Keep your baseline marker anchors and move them with the same deformation field.
  const topMarker = markerCenter(outer, -Math.PI / 2, 7);
  const bottomMarker = markerCenter(outer, Math.PI / 2, 7);
  const leftMarker = markerCenter(outer, Math.PI, 6);
  const rightMarker = markerCenter(outer, 0, 6);

  return (
    <G id="head" transform={`rotate(${rotateDeg} ${x} ${y})`}>
      <Path d={outer.path} fill={palette.body} />
      <Path d={inner.path} fill={palette.inner} />
      <Path
        d={markerPath(topMarker.x, topMarker.y, 0, 1, 9.4)}
        stroke={palette.stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d={markerPath(bottomMarker.x, bottomMarker.y, 0, 1, 9.4)}
        stroke={palette.stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d={markerPath(leftMarker.x, leftMarker.y, 1, 0, 9.4)}
        stroke={palette.stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d={markerPath(rightMarker.x, rightMarker.y, 1, 0, 9.4)}
        stroke={palette.stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <G transform={`translate(${outer.x - 60} ${outer.y - 54})`}>
        <EyesPart eyesScaleY={eyesScaleY} gazeX={gazeX} />
        <MouthPart expression={expression} />
      </G>
    </G>
  );
}

export function TimiBase({
  tone = 'mint',
  size = 56,
  expression = 'neutral',
  transforms,
  facePullX = 0,
  facePullY = 0,
  faceDepth = 0,
  faceFocusX = 0,
  faceFocusY = 0,
  showShadow = true,
}: TimiBaseProps) {
  const palette = PALETTE_BY_TONE[tone];
  const next = {
    ...TIMI_PART_DEFAULT_TRANSFORMS,
    ...(transforms ?? {}),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {showShadow ? (
        <Ellipse cx="60" cy="97" rx="22" ry="5" fill="#1F2A44" fillOpacity="0.08" />
      ) : null}
      <BodyPart palette={palette} translateY={next.bodyTranslateY} />
      <LeftArmPart palette={palette} rotateDeg={next.leftArmRotateDeg} />
      <RightArmPart
        palette={palette}
        rotateDeg={next.rightArmRotateDeg}
        translateY={next.rightArmTranslateY}
      />
      <HeadPart
        palette={palette}
        rotateDeg={next.headRotateDeg}
        eyesScaleY={next.eyesScaleY}
        gazeX={next.gazeX}
        expression={expression}
        facePullX={facePullX}
        facePullY={facePullY}
        faceDepth={faceDepth}
        faceFocusX={faceFocusX}
        faceFocusY={faceFocusY}
      />
    </Svg>
  );
}
