import { Circle, Group, RoundedRect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

type AnimatedNumber = { value: number };

interface CharacterPalette {
  body: string;
  inner: string;
  stroke: string;
}

interface CharacterBodyProps {
  palette: CharacterPalette;
  scaleX: AnimatedNumber;
  scaleY: AnimatedNumber;
  offsetY: AnimatedNumber;
}

export function CharacterBody({ palette, scaleX, scaleY, offsetY }: CharacterBodyProps) {
  const transform = useDerivedValue(() => [
    { translateX: 60 },
    { translateY: 54 + offsetY.value },
    { scaleX: scaleX.value },
    { scaleY: scaleY.value },
    { translateX: -60 },
    { translateY: -54 },
  ]);

  return (
    <Group transform={transform}>
      <Circle cx={60} cy={54} r={37} color={palette.body} />
      <Circle cx={60} cy={54} r={32.8} color={palette.inner} />
      <RoundedRect x={58.9} y={18.2} width={2.2} height={10} r={1.1} color={palette.stroke} />
      <RoundedRect x={58.9} y={79.8} width={2.2} height={10} r={1.1} color={palette.stroke} />
      <RoundedRect x={91.8} y={52.9} width={10} height={2.2} r={1.1} color={palette.stroke} />
      <RoundedRect x={18.2} y={52.9} width={10} height={2.2} r={1.1} color={palette.stroke} />
    </Group>
  );
}
