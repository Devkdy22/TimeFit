import { Animated, StyleSheet } from 'react-native';
import type { UiStatus } from '../../theme/status-config';
import { Timi } from './Timi';
import { useTimiAnimation, type TimiInteraction, type TimiMood } from './useTimiAnimation';

export interface TimiAnimatedProps {
  status: UiStatus;
  size?: number;
  mood: TimiMood;
  interaction: TimiInteraction;
  signal: number;
}

function mapStatusToTone(status: UiStatus): 'mint' | 'orange' | 'red' {
  if (status === 'urgent') {
    return 'red';
  }
  if (status === 'warning') {
    return 'orange';
  }
  return 'mint';
}

export function TimiAnimated({ status, size = 118, mood, interaction, signal }: TimiAnimatedProps) {
  const {
    containerStyle,
    blink,
    gazeX,
    expression,
    headRotateDeg,
    bodyTranslateY,
    leftArmRotateDeg,
    rightArmRotateDeg,
  } = useTimiAnimation({ mood, interaction, signal });

  return (
    <Animated.View style={[styles.wrap, containerStyle]}>
      <Timi
        tone={mapStatusToTone(status)}
        size={size}
        blink={blink}
        gazeX={gazeX}
        expression={expression}
        headRotateDeg={headRotateDeg}
        bodyTranslateY={bodyTranslateY}
        leftArmRotateDeg={leftArmRotateDeg}
        rightArmRotateDeg={rightArmRotateDeg}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
