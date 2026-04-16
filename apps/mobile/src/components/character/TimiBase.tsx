import { Animated } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
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
    inner: '#E4FFFD',
    stroke: '#3FB0A7',
  },
  orange: {
    body: '#FCB451',
    inner: '#FFF2E8',
    stroke: '#E18A2F',
  },
  red: {
    body: '#D26767',
    inner: '#FFEAEA',
    stroke: '#B35252',
  },
};

export interface TimiBaseProps {
  tone?: TimiTone;
  size?: number;
  expression?: TimiExpression;
  transforms?: Partial<TimiPartTransforms>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

export function BodyPart({
  palette,
  translateY,
}: {
  palette: TimiPalette;
  translateY: number;
}) {
  return (
    <G id="body" transform={`translate(0 ${translateY})`}>
      <Ellipse cx="60" cy="94" rx="24" ry="18" fill={palette.body} />
      <Ellipse cx="60" cy="92" rx="19" ry="14" fill={palette.inner} />
      <Rect x="51" y="103" width="7" height="9" rx="3.5" fill={palette.body} />
      <Rect x="62" y="103" width="7" height="9" rx="3.5" fill={palette.body} />
    </G>
  );
}

export function LeftArmPart({
  palette,
  rotateDeg,
}: {
  palette: TimiPalette;
  rotateDeg: number;
}) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.leftArm;
  return (
    <G id="leftArm" transform={`rotate(${rotateDeg} ${x} ${y})`}>
      <Rect x="28" y="70" width="20" height="10" rx="5" fill={palette.body} />
      <Circle cx="28" cy="75" r="4" fill={palette.body} />
    </G>
  );
}

export function RightArmPart({
  palette,
  rotateDeg,
}: {
  palette: TimiPalette;
  rotateDeg: number;
}) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.rightArm;
  return (
    <G id="rightArm" transform={`rotate(${rotateDeg} ${x} ${y})`}>
      <Rect x="72" y="70" width="20" height="10" rx="5" fill={palette.body} />
      <Circle cx="92" cy="75" r="4" fill={palette.body} />
    </G>
  );
}

export function EyesPart({
  eyesScaleY,
  gazeX,
}: {
  eyesScaleY: number;
  gazeX: number;
}) {
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
      <Path d={mouthPathByExpression(expression)} stroke="#1F2A44" strokeWidth="3" strokeLinecap="round" />
    </G>
  );
}

export function HeadPart({
  palette,
  rotateDeg,
  eyesScaleY,
  gazeX,
  expression,
}: {
  palette: TimiPalette;
  rotateDeg: number;
  eyesScaleY: number;
  gazeX: number;
  expression: TimiExpression;
}) {
  const { x, y } = TIMI_TRANSFORM_ORIGIN.head;
  return (
    <G id="head" transform={`rotate(${rotateDeg} ${x} ${y})`}>
      <Circle cx="60" cy="54" r="36" fill={palette.body} />
      <Circle cx="60" cy="54" r="32" fill={palette.inner} />
      <Rect x="58.9" y="18.8" width="2.2" height="9.4" rx="1.1" fill={palette.stroke} />
      <Rect x="58.9" y="79.4" width="2.2" height="9.4" rx="1.1" fill={palette.stroke} />
      <Rect x="94.8" y="53.6" width="2.2" height="9.4" rx="1.1" transform="rotate(90 94.8 53.6)" fill={palette.stroke} />
      <Rect x="34.2" y="53.6" width="2.2" height="9.4" rx="1.1" transform="rotate(90 34.2 53.6)" fill={palette.stroke} />
      <EyesPart eyesScaleY={eyesScaleY} gazeX={gazeX} />
      <MouthPart expression={expression} />
    </G>
  );
}

export function TimiBase({
  tone = 'mint',
  size = 56,
  expression = 'neutral',
  transforms,
}: TimiBaseProps) {
  const palette = PALETTE_BY_TONE[tone];
  const next = {
    ...TIMI_PART_DEFAULT_TRANSFORMS,
    ...(transforms ?? {}),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Ellipse cx="60" cy="111" rx="22" ry="5" fill="#1F2A44" fillOpacity="0.08" />
      <BodyPart palette={palette} translateY={next.bodyTranslateY} />
      <LeftArmPart palette={palette} rotateDeg={next.leftArmRotateDeg} />
      <RightArmPart palette={palette} rotateDeg={next.rightArmRotateDeg} />
      <HeadPart
        palette={palette}
        rotateDeg={next.headRotateDeg}
        eyesScaleY={next.eyesScaleY}
        gazeX={next.gazeX}
        expression={expression}
      />
    </Svg>
  );
}
