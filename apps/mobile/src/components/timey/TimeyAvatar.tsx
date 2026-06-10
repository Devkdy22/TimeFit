import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { timeyMotion } from '../../constants/timey/timeyMotion';
import type { TimeyProps, TimeyState } from '../../types/timey.types';
import { getTimeyAccessibilityLabel } from './TimeyController';
import { TimeyGlow } from './TimeyGlow';
import { TimeyCanonicalSvg } from './source/TimeyCanonicalSvg';

const AnimatedView = Animated.createAnimatedComponent(View);

export const TIMEY_CANONICAL_SOURCE = {
  type: 'svg-component',
  component: 'src/components/timey/source/TimeyCanonicalSvg.tsx',
  svgAsset: 'assets/characters/timey/source/timey.svg',
} as const;

function resolveSize(size: TimeyProps['size']) {
  if (typeof size === 'number') return size;
  if (size === 'sm') return 64;
  if (size === 'lg') return 120;
  return 96;
}

function BaseTimeyAvatar({
  state = 'idle',
  size = 'md',
  animated = true,
  glow = false,
  accessibilityLabel,
}: TimeyProps) {
  const resolvedSize = resolveSize(size);
  const resolvedAccessibilityLabel = accessibilityLabel ?? getTimeyAccessibilityLabel(state);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: timeyMotion.idleFloat.duration,
            easing: Easing.inOut(Easing.cubic),
          }),
          withTiming(0, {
            duration: timeyMotion.idleFloat.duration,
            easing: Easing.inOut(Easing.cubic),
          }),
        ),
        -1,
        false,
      );
      return;
    }

    progress.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [animated, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [timeyMotion.idleFloat.translateY.from, timeyMotion.idleFloat.translateY.to],
        ),
      },
    ],
  }));

  return (
    <TimeyGlow state={state as TimeyState} size={resolvedSize} enabled={glow}>
      <AnimatedView
        accessibilityRole="image"
        accessibilityLabel={resolvedAccessibilityLabel}
        style={[styles.wrap, animatedStyle, { width: resolvedSize, height: resolvedSize }]}
      >
        <TimeyCanonicalSvg state={state as TimeyState} size={resolvedSize} />
      </AnimatedView>
    </TimeyGlow>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});

export const TimeyAvatar = memo(BaseTimeyAvatar);
