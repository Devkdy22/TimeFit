import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../theme/theme';
import { timiMotionPresets, type TimiMovement } from './motion-presets';
import { TimiSvg, type TimiVariant } from './timi-svg';

export type TimiEmotion = 'neutral' | 'happy' | 'focused' | 'panic';

export interface TimiProps {
  variant: TimiVariant;
  movement: TimiMovement;
  emotion?: TimiEmotion;
  size?: number;
  style?: StyleProp<ViewStyle>;
  position?: {
    x: number;
    y: number;
  };
}

const emotionOpacityMap: Record<TimiEmotion, number> = {
  neutral: 0.16,
  happy: 0.2,
  focused: 0.24,
  panic: 0.3,
};

const variantColorMap: Record<TimiVariant, string> = {
  mint: theme.colors.accent.relaxed,
  orange: theme.colors.accent.warning,
  red: theme.colors.accent.urgent,
};

export function Timi({
  variant,
  movement,
  emotion = 'neutral',
  size = 44,
  style,
  position,
}: TimiProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const preset = timiMotionPresets[movement];
    const ease = Easing.bezier(...theme.motion.easing.standard);

    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(scale);
    cancelAnimation(rotate);

    if (movement === 'idle') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-preset.translateY, { duration: preset.duration, easing: ease }),
          withTiming(0, { duration: preset.duration, easing: ease }),
        ),
        -1,
        false,
      );
      return;
    }

    if (movement === 'walk') {
      translateX.value = withRepeat(
        withSequence(
          withTiming(-preset.translateX, { duration: preset.duration, easing: ease }),
          withTiming(preset.translateX, { duration: preset.duration, easing: ease }),
          withTiming(0, { duration: preset.duration, easing: ease }),
        ),
        -1,
        false,
      );
      translateY.value = withRepeat(
        withSequence(
          withTiming(-preset.translateY, { duration: preset.duration, easing: ease }),
          withTiming(0, { duration: preset.duration, easing: ease }),
        ),
        -1,
        false,
      );
      return;
    }

    if (movement === 'run') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-preset.translateY, { duration: preset.duration, easing: ease }),
          withTiming(0, { duration: preset.duration, easing: ease }),
        ),
        -1,
        false,
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(preset.scale, { duration: preset.duration, easing: ease }),
          withTiming(1, { duration: preset.duration, easing: ease }),
        ),
        -1,
        false,
      );
      return;
    }

    rotate.value = withRepeat(
      withSequence(
        withTiming(-preset.rotateDeg, { duration: preset.duration, easing: ease }),
        withTiming(preset.rotateDeg, { duration: preset.duration, easing: ease }),
        withTiming(0, { duration: preset.duration, easing: ease }),
      ),
      -1,
      false,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-preset.translateY, { duration: preset.duration, easing: ease }),
        withTiming(0, { duration: preset.duration, easing: ease }),
      ),
      -1,
      false,
    );
  }, [movement, rotate, scale, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.base,
        position
          ? {
              left: position.x - size / 2,
              top: position.y - size,
              position: 'absolute',
            }
          : null,
        animatedStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.emotionHalo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: variantColorMap[variant],
            opacity: emotionOpacityMap[emotion],
          },
        ]}
      />
      <TimiSvg variant={variant} width={size} height={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emotionHalo: {
    position: 'absolute',
    transform: [{ scale: 1.2 }],
  },
});

