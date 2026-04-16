import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

type AnimatedNumber = { value: number };

interface CharacterFaceProps {
  eyeOffsetX: AnimatedNumber;
  eyeOffsetY: AnimatedNumber;
  eyeScaleY: AnimatedNumber;
  leftEyebrowRotationDeg: AnimatedNumber;
  rightEyebrowRotationDeg: AnimatedNumber;
  mouthNeutralOpacity: AnimatedNumber;
  mouthSmileOpacity: AnimatedNumber;
  mouthStressedOpacity: AnimatedNumber;
  mouthSurprisedOpacity: AnimatedNumber;
}

export function CharacterFace({
  eyeOffsetX,
  eyeOffsetY,
  eyeScaleY,
  leftEyebrowRotationDeg,
  rightEyebrowRotationDeg,
  mouthNeutralOpacity,
  mouthSmileOpacity,
  mouthStressedOpacity,
  mouthSurprisedOpacity,
}: CharacterFaceProps) {
  const eyesTransform = useDerivedValue(() => [
    { translateX: eyeOffsetX.value },
    { translateY: eyeOffsetY.value },
    { translateX: 60 },
    { translateY: 46 },
    { scaleY: eyeScaleY.value },
    { translateX: -60 },
    { translateY: -46 },
  ]);

  const leftBrowTransform = useDerivedValue(() => [
    { translateX: 49 },
    { translateY: 36 },
    { rotate: (leftEyebrowRotationDeg.value * Math.PI) / 180 },
    { translateX: -49 },
    { translateY: -36 },
  ]);

  const rightBrowTransform = useDerivedValue(() => [
    { translateX: 71 },
    { translateY: 36 },
    { rotate: (rightEyebrowRotationDeg.value * Math.PI) / 180 },
    { translateX: -71 },
    { translateY: -36 },
  ]);

  return (
    <>
      <Group transform={leftBrowTransform}>
        <RoundedRect x={43} y={34.8} width={12} height={2.3} r={1.15} color="#2A3858" />
      </Group>
      <Group transform={rightBrowTransform}>
        <RoundedRect x={65} y={34.8} width={12} height={2.3} r={1.15} color="#2A3858" />
      </Group>

      <Group transform={eyesTransform}>
        <Circle cx={48} cy={46} r={3.6} color="#EAF1FF" />
        <Circle cx={72} cy={46} r={3.6} color="#EAF1FF" />

        <Circle cx={48} cy={46} r={2.6} color="#243252" />
        <Circle cx={72} cy={46} r={2.6} color="#243252" />

        <Circle cx={47.3} cy={45.2} r={0.72} color="#FFFFFF" />
        <Circle cx={71.3} cy={45.2} r={0.72} color="#FFFFFF" />
      </Group>

      <Path
        path="M50 55 C55 56 65 56 70 55"
        color="#1F2A44"
        style="stroke"
        strokeWidth={3.2}
        strokeCap="round"
        opacity={mouthNeutralOpacity}
      />
      <Path
        path="M50 53 C54 60 66 60 70 53"
        color="#1F2A44"
        style="stroke"
        strokeWidth={3.2}
        strokeCap="round"
        opacity={mouthSmileOpacity}
      />
      <Path
        path="M50 58 C54 52 66 52 70 58"
        color="#1F2A44"
        style="stroke"
        strokeWidth={3.2}
        strokeCap="round"
        opacity={mouthStressedOpacity}
      />
      <Circle cx={60} cy={56} r={3.2} color="#1F2A44" opacity={mouthSurprisedOpacity} />
    </>
  );
}
