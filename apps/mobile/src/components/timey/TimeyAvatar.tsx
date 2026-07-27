import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
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
import { getTimeyMotionKeyframes, getTimeyMotionProfile } from './timeyDisplay';
import { recordTimeyBlinkTimerCreated } from './timeyQaDiagnostics';
import {
  TIMEY_GREETING_PROGRESS,
  TIMEY_GREETING_ROTATION_DEG,
  TIMEY_GREETING_TRANSLATE_Y,
  canRunTimeyGreeting,
} from './timeyGreeting';

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
  greeting = false,
  greetingReplayNonce = 0,
}: TimeyProps) {
  const resolvedSize = resolveSize(size);
  const resolvedAccessibilityLabel = accessibilityLabel ?? getTimeyAccessibilityLabel(state);
  const progress = useSharedValue(0);
  const greetingProgress = useSharedValue(0);
  const [blink, setBlink] = useState(1);
  const motionProfile = getTimeyMotionProfile(state as TimeyState);
  const motionXFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'x').map((value) => value * motionProfile.translateX), [motionProfile]);
  const motionYFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'y').map((value) => value * motionProfile.translateY), [motionProfile]);
  const motionRotateFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'rotate').map((value) => value * motionProfile.rotateDeg), [motionProfile]);

  useEffect(() => {
    if (animated) {
      const cycle = withSequence(
        withTiming(1, { duration: motionProfile.cycleMs, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: motionProfile.cycleMs, easing: Easing.inOut(Easing.cubic) }),
      );
      progress.value = motionProfile.oneShot
        ? withSequence(cycle, withTiming(0, { duration: 120 }))
        : withRepeat(cycle, -1, false);
      return;
    }

    progress.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [animated, motionProfile, progress]);

  const greetingEnabled = animated && greeting && canRunTimeyGreeting(state as TimeyState);

  useEffect(() => {
    cancelAnimation(greetingProgress);
    if (!greetingEnabled) {
      greetingProgress.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
      return () => undefined;
    }

    greetingProgress.value = withSequence(
      withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }),
      withTiming(0.14, { duration: 120, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0.84, { duration: 120, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0.1, { duration: 120, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0.72, { duration: 120, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: 230, easing: Easing.inOut(Easing.cubic) }),
    );

    return () => {
      cancelAnimation(greetingProgress);
      greetingProgress.value = 0;
    };
  }, [greetingEnabled, greetingProgress, greetingReplayNonce]);

  useEffect(() => {
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    if (!animated) {
      setBlink(1);
      return () => undefined;
    }
    const schedule = () => {
      openTimer = setTimeout(() => {
        if (cancelled) return;
        setBlink(0);
        closeTimer = setTimeout(() => {
          if (cancelled) return;
          setBlink(1);
          schedule();
        }, 95);
      }, timeyMotion.blink.minIntervalMs + Math.random() * (timeyMotion.blink.maxIntervalMs - timeyMotion.blink.minIntervalMs));
    };
    recordTimeyBlinkTimerCreated();
    schedule();
    return () => {
      cancelled = true;
      if (openTimer) clearTimeout(openTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], motionXFrames) },
      { translateY: interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], motionYFrames) },
      { rotate: `${interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], motionRotateFrames)}deg` },
      { scale: 1 + interpolate(progress.value, [0, 1], [0, motionProfile.scale + motionProfile.breathing]) },
    ],
  }));

  const rightArmAnimatedProps = useAnimatedProps(() => {
    const translateY = interpolate(greetingProgress.value, TIMEY_GREETING_PROGRESS, TIMEY_GREETING_TRANSLATE_Y);
    const rotateRad = (interpolate(greetingProgress.value, TIMEY_GREETING_PROGRESS, TIMEY_GREETING_ROTATION_DEG) * Math.PI) / 180;
    const cos = Math.cos(rotateRad);
    const sin = Math.sin(rotateRad);
    const pivotX = 96;
    const pivotY = 55;

    return {
      // SVG Fabric receives matrix [a, b, c, d, tx, ty] directly from
      // Reanimated; passing a transform string would crash on Android.
      matrix: [
        cos,
        sin,
        -sin,
        cos,
        pivotX - cos * pivotX + sin * pivotY,
        pivotY - sin * pivotX - cos * pivotY + translateY,
      ],
    };
  });

  return (
    <TimeyGlow state={state as TimeyState} size={resolvedSize} enabled={glow}>
      <AnimatedView
        accessibilityRole="image"
        accessibilityLabel={resolvedAccessibilityLabel}
        style={[styles.wrap, animatedStyle, { width: resolvedSize, height: resolvedSize }]}
      >
        <TimeyCanonicalSvg
          state={state as TimeyState}
          size={resolvedSize}
          blink={blink}
          rightArmAnimatedProps={rightArmAnimatedProps}
        />
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
