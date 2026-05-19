import { StyleSheet, View } from 'react-native';
import { Timi, type TimiProps } from '../character/Timi';

interface TimeyMascotProps {
  size?: number;
  expression?: TimiProps['expression'];
}

export function TimeyMascot({ size = 72, expression = 'smile' }: TimeyMascotProps) {
  return (
    <View style={styles.wrap}>
      <Timi size={size} expression={expression} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
