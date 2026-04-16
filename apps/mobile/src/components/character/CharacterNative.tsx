import { Canvas, Group, Oval } from '@shopify/react-native-skia';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import { useCharacterAnimation, type CharacterState } from '../../hooks/useCharacterAnimation';
import { useCharacterGesture } from '../../hooks/useCharacterGesture';
import { clamp } from '../../utils/physics';
import { CharacterArms } from './CharacterArms';
import { CharacterBody } from './CharacterBody';
import { CharacterFace } from './CharacterFace';
import { CharacterLegs } from './CharacterLegs';

export type CharacterTone = 'mint' | 'orange' | 'red';

interface CharacterPalette {
  body: string;
  inner: string;
  stroke: string;
}

const PALETTE_BY_TONE: Record<CharacterTone, CharacterPalette> = {
  mint: {
    body: '#67CDC5',
    inner: '#DDF8F6',
    stroke: '#58C8C0',
  },
  orange: {
    body: '#F7B04B',
    inner: '#FFF2E4',
    stroke: '#F2A73A',
  },
  red: {
    body: '#D86D72',
    inner: '#FFECEE',
    stroke: '#CF6167',
  },
};

export interface CharacterProps {
  size?: number;
  tone?: CharacterTone;
  state?: CharacterState;
}

const ARTBOARD_SIZE = 120;

export function Character({ size = 220, tone = 'mint', state = 'idle' }: CharacterProps) {
  const center = size / 2;
  const palette = PALETTE_BY_TONE[tone];

  const gesture = useCharacterGesture({
    initialX: center,
    initialY: center,
    maxDragX: size * 0.26,
    maxDragY: size * 0.31,
  });

  const animation = useCharacterAnimation({
    state,
    centerX: center,
    centerY: center,
    gesture,
  });

  const scale = size / ARTBOARD_SIZE;

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animation.characterX.value },
      { translateY: animation.characterY.value },
      { rotate: `${animation.characterRotationDeg.value}deg` },
    ],
  }));

  const rootTransform = useDerivedValue(() => [
    { translateX: center - 60 * scale },
    { translateY: center - 60 * scale },
    { scale },
  ]);

  const shadowOpacity = useDerivedValue(() => {
    const lift = animation.characterY.value;
    const dragY = gesture.currentY.value - center;
    const dist = gesture.dragDistance.value;
    if (lift < -4 || dist > 72 || dragY < -8) {
      return 0;
    }
    return 1;
  });

  const shadowScaleX = useDerivedValue(() => {
    const dragY = gesture.currentY.value - center;
    return clamp(1 + dragY * 0.0045, 0.92, 1.34);
  });

  const shadowScaleY = useDerivedValue(() => {
    const dragY = gesture.currentY.value - center;
    return clamp(1 + dragY * 0.0022, 0.88, 1.2);
  });

  const shadowTransform = useDerivedValue(() => [
    { translateX: center },
    { translateY: center + 58 * scale },
    { scaleX: shadowScaleX.value },
    { scaleY: shadowScaleY.value },
    { translateX: -center },
    { translateY: -(center + 58 * scale) },
  ]);

  return (
    <GestureDetector gesture={gesture.gesture}>
      <Animated.View style={[{ width: size, height: size }, wrapperStyle]}>
        <Canvas style={{ width: size, height: size }}>
          <Group transform={shadowTransform} opacity={shadowOpacity}>
            <Oval
              x={center - 22 * scale}
              y={center + 58 * scale - 5.6 * scale}
              width={44 * scale}
              height={11.2 * scale}
              color="rgba(31,42,68,0.14)"
            />
          </Group>

          <Group transform={rootTransform}>
            <CharacterLegs
              palette={palette}
              leftRotationDeg={animation.leftLegRotationDeg}
              rightRotationDeg={animation.rightLegRotationDeg}
            />
            <CharacterArms
              palette={palette}
              leftRotationDeg={animation.leftArmRotationDeg}
              rightRotationDeg={animation.rightArmRotationDeg}
            />
            <CharacterBody
              palette={palette}
              scaleX={animation.bodyScaleX}
              scaleY={animation.bodyScaleY}
              offsetY={animation.bodyOffsetY}
            />
            <CharacterFace
              eyeOffsetX={animation.eyeOffsetX}
              eyeOffsetY={animation.eyeOffsetY}
              eyeScaleY={animation.eyeScaleY}
              leftEyebrowRotationDeg={animation.leftEyebrowRotationDeg}
              rightEyebrowRotationDeg={animation.rightEyebrowRotationDeg}
              mouthNeutralOpacity={animation.mouthNeutralOpacity}
              mouthSmileOpacity={animation.mouthSmileOpacity}
              mouthStressedOpacity={animation.mouthStressedOpacity}
              mouthSurprisedOpacity={animation.mouthSurprisedOpacity}
            />
          </Group>
        </Canvas>
      </Animated.View>
    </GestureDetector>
  );
}
