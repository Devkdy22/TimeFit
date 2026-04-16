import { Group, Oval } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

type AnimatedNumber = { value: number };

interface CharacterPalette {
  body: string;
}

interface CharacterLegsProps {
  palette: CharacterPalette;
  leftRotationDeg: AnimatedNumber;
  rightRotationDeg: AnimatedNumber;
}

function legTransform(rotationDeg: AnimatedNumber, pivotX: number, pivotY: number) {
  return useDerivedValue(() => [
    { translateX: pivotX },
    { translateY: pivotY },
    { rotate: (rotationDeg.value * Math.PI) / 180 },
    { translateX: -pivotX },
    { translateY: -pivotY },
  ]);
}

export function CharacterLegs({ palette, leftRotationDeg, rightRotationDeg }: CharacterLegsProps) {
  const leftTransform = legTransform(leftRotationDeg, 48, 84);
  const rightTransform = legTransform(rightRotationDeg, 72, 84);

  return (
    <>
      <Group transform={leftTransform}>
        <Oval x={39.6} y={79.5} width={16.8} height={19} color={palette.body} />
      </Group>
      <Group transform={rightTransform}>
        <Oval x={63.6} y={79.5} width={16.8} height={19} color={palette.body} />
      </Group>
    </>
  );
}
