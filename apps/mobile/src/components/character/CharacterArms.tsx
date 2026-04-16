import { Group, Oval, RoundedRect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

type AnimatedNumber = { value: number };

interface CharacterPalette {
  body: string;
}

interface CharacterArmsProps {
  palette: CharacterPalette;
  leftRotationDeg: AnimatedNumber;
  rightRotationDeg: AnimatedNumber;
}

function armTransform(rotationDeg: AnimatedNumber, pivotX: number, pivotY: number) {
  return useDerivedValue(() => [
    { translateX: pivotX },
    { translateY: pivotY },
    { rotate: (rotationDeg.value * Math.PI) / 180 },
    { translateX: -pivotX },
    { translateY: -pivotY },
  ]);
}

export function CharacterArms({ palette, leftRotationDeg, rightRotationDeg }: CharacterArmsProps) {
  const leftTransform = armTransform(leftRotationDeg, 40, 57);
  const rightTransform = armTransform(rightRotationDeg, 80, 57);

  return (
    <>
      <Group transform={leftTransform}>
        <RoundedRect x={26.5} y={49.5} width={14.8} height={24.8} r={7.4} color={palette.body} />
        <Oval x={26.2} y={64.4} width={14.6} height={12.2} color={palette.body} />
      </Group>
      <Group transform={rightTransform}>
        <RoundedRect x={78.7} y={49.5} width={14.8} height={24.8} r={7.4} color={palette.body} />
        <Oval x={78.7} y={64.4} width={14.6} height={12.2} color={palette.body} />
      </Group>
    </>
  );
}
