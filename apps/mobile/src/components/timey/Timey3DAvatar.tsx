import { memo, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { TimeyProps, TimeyState } from '../../types/timey.types';
import { getTimeyAccessibilityLabel } from './TimeyController';
import { TimeyAvatar } from './TimeyAvatar';
import { getTimeyMotionKeyframes, getTimeyMotionProfile } from './timeyDisplay';
import timeyBaseAsset from '../../../assets/characters/timey/3d/timey-base-v5-mouth-large.png';
import timeyWarningAsset from '../../../assets/characters/timey/3d/timey-warning-v1.png';
import timeyWalkingAsset from '../../../assets/characters/timey/3d/timey-walking-v1.png';
import timeySuccessAsset from '../../../assets/characters/timey/3d/timey-success-v1.png';

const ASSETS_3D: Partial<Record<TimeyState, number>> = {
  idle: timeyBaseAsset,
  searching: timeyBaseAsset,
  confident: timeyBaseAsset,
  waiting: timeyBaseAsset,
  walking: timeyWalkingAsset,
  riding_bus: timeyWalkingAsset,
  riding_subway: timeyWalkingAsset,
  transfer: timeyBaseAsset,
  warning: timeyWarningAsset,
  urgent: timeyWarningAsset,
  panic: timeyWarningAsset,
  offroute: timeyWarningAsset,
  rerouting: timeyWarningAsset,
  success: timeySuccessAsset,
  late: timeyWarningAsset,
};

export const TIMEY_3D_ASSET_PATHS: Partial<Record<TimeyState, string>> = {
  idle: 'assets/characters/timey/3d/timey-base-v5-mouth-large.png',
  searching: 'assets/characters/timey/3d/timey-base-v5-mouth-large.png',
  confident: 'assets/characters/timey/3d/timey-base-v5-mouth-large.png',
  waiting: 'assets/characters/timey/3d/timey-base-v5-mouth-large.png',
  walking: 'assets/characters/timey/3d/timey-walking-v1.png',
  riding_bus: 'assets/characters/timey/3d/timey-walking-v1.png',
  riding_subway: 'assets/characters/timey/3d/timey-walking-v1.png',
  transfer: 'assets/characters/timey/3d/timey-base-v5-mouth-large.png',
  warning: 'assets/characters/timey/3d/timey-warning-v1.png',
  urgent: 'assets/characters/timey/3d/timey-warning-v1.png',
  panic: 'assets/characters/timey/3d/timey-warning-v1.png',
  offroute: 'assets/characters/timey/3d/timey-warning-v1.png',
  rerouting: 'assets/characters/timey/3d/timey-warning-v1.png',
  success: 'assets/characters/timey/3d/timey-success-v1.png',
  late: 'assets/characters/timey/3d/timey-warning-v1.png',
};

type Timey3DAssetVariant = {
  asset: string;
  poseVariant: 'base' | 'warning' | 'success';
  colorVariant: 'base';
  alternateColorAvailable: boolean;
};

const SVG_FALLBACK_ASSET = '(svg-fallback)';

function assetPath(state: TimeyState): string {
  return TIMEY_3D_ASSET_PATHS[state] ?? SVG_FALLBACK_ASSET;
}

export const TIMEY_3D_ASSET_VARIANTS: Record<TimeyState, Timey3DAssetVariant> = {
  idle: { asset: assetPath('idle'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  searching: { asset: assetPath('searching'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  confident: { asset: assetPath('confident'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  waiting: { asset: assetPath('waiting'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  walking: { asset: assetPath('walking'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  riding_bus: { asset: assetPath('riding_bus'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  riding_subway: { asset: assetPath('riding_subway'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  transfer: { asset: assetPath('transfer'), poseVariant: 'base', colorVariant: 'base', alternateColorAvailable: false },
  warning: { asset: assetPath('warning'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
  urgent: { asset: assetPath('urgent'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
  panic: { asset: assetPath('panic'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
  offroute: { asset: assetPath('offroute'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
  rerouting: { asset: assetPath('rerouting'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
  success: { asset: assetPath('success'), poseVariant: 'success', colorVariant: 'base', alternateColorAvailable: false },
  late: { asset: assetPath('late'), poseVariant: 'warning', colorVariant: 'base', alternateColorAvailable: false },
};

function resolve3DAssetSize(state: TimeyState) {
  const asset = ASSETS_3D[state];
  if (!asset) return { width: 0, height: 0 };
  const src = Image.resolveAssetSource(asset);
  return { width: src?.width ?? 0, height: src?.height ?? 0 };
}

export const TIMEY_3D_ASSET_META: Record<TimeyState, { width: number; height: number; isPlaceholder: boolean }> = {
  idle: { ...resolve3DAssetSize('idle'), isPlaceholder: false },
  searching: { ...resolve3DAssetSize('searching'), isPlaceholder: false },
  confident: { ...resolve3DAssetSize('confident'), isPlaceholder: false },
  waiting: { ...resolve3DAssetSize('waiting'), isPlaceholder: false },
  walking: { ...resolve3DAssetSize('walking'), isPlaceholder: false },
  riding_bus: { ...resolve3DAssetSize('riding_bus'), isPlaceholder: false },
  riding_subway: { ...resolve3DAssetSize('riding_subway'), isPlaceholder: false },
  transfer: { ...resolve3DAssetSize('transfer'), isPlaceholder: false },
  warning: { ...resolve3DAssetSize('warning'), isPlaceholder: false },
  urgent: { ...resolve3DAssetSize('urgent'), isPlaceholder: false },
  panic: { ...resolve3DAssetSize('panic'), isPlaceholder: false },
  offroute: { ...resolve3DAssetSize('offroute'), isPlaceholder: false },
  rerouting: { ...resolve3DAssetSize('rerouting'), isPlaceholder: false },
  success: { ...resolve3DAssetSize('success'), isPlaceholder: false },
  late: { ...resolve3DAssetSize('late'), isPlaceholder: false },
};

for (const key of Object.keys(TIMEY_3D_ASSET_META) as TimeyState[]) {
  const info = TIMEY_3D_ASSET_META[key];
  info.isPlaceholder = info.width <= 4 || info.height <= 4;
}

export function isTimey3DMissing(state: TimeyState): boolean {
  return TIMEY_3D_ASSET_META[state].isPlaceholder;
}

function resolveSize(size: TimeyProps['size']) {
  if (typeof size === 'number') return size;
  if (size === 'sm') return 64;
  if (size === 'lg') return 120;
  return 96;
}

function BaseTimey3DAvatar({ state = 'idle', size = 'md', accessibilityLabel, animated, glow, greeting, greetingReplayNonce }: TimeyProps) {
  const resolvedSize = resolveSize(size);
  const resolvedAccessibilityLabel = accessibilityLabel ?? getTimeyAccessibilityLabel(state);
  const [fallbackStage, setFallbackStage] = useState<0 | 1>(0);
  const motion = useSharedValue(0);
  const motionProfile = getTimeyMotionProfile(state);
  const motionXFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'x').map((value) => value * motionProfile.translateX), [motionProfile]);
  const motionYFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'y').map((value) => value * motionProfile.translateY), [motionProfile]);
  const motionRotateFrames = useMemo(() => getTimeyMotionKeyframes(motionProfile.pattern, 'rotate').map((value) => value * motionProfile.rotateDeg), [motionProfile]);
  const visualSize = resolvedSize * 1.65;

  useEffect(() => {
    setFallbackStage(0);
  }, [state]);

  useEffect(() => {
    cancelAnimation(motion);

    if (!animated || fallbackStage === 1 || isTimey3DMissing(state)) {
      motion.value = withTiming(0, { duration: 160 });
      return () => cancelAnimation(motion);
    }

    const cycle = withSequence(
      withTiming(1, { duration: motionProfile.cycleMs, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0, { duration: motionProfile.cycleMs, easing: Easing.inOut(Easing.cubic) }),
    );
    motion.value = motionProfile.oneShot
      ? withSequence(cycle, withTiming(0, { duration: 120 }))
      : withRepeat(cycle, -1, false);

    return () => {
      cancelAnimation(motion);
      motion.value = 0;
    };
  }, [animated, fallbackStage, motion, motionProfile, state]);

  const motionStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: interpolate(motion.value, [0, 0.25, 0.5, 0.75, 1], motionXFrames) },
        { translateY: interpolate(motion.value, [0, 0.25, 0.5, 0.75, 1], motionYFrames) },
        { rotate: `${interpolate(motion.value, [0, 0.25, 0.5, 0.75, 1], motionRotateFrames)}deg` },
        { scale: 1 + motion.value * (motionProfile.scale + motionProfile.breathing) },
      ],
    };
  }, [motion, motionRotateFrames, motionXFrames, motionYFrames]);
  const source = useMemo(() => ASSETS_3D[state] ?? timeyBaseAsset, [state]);

  if (isTimey3DMissing(state)) {
    return <TimeyAvatar state={state} size={resolvedSize} animated={animated} glow={glow} greeting={greeting} greetingReplayNonce={greetingReplayNonce} accessibilityLabel={resolvedAccessibilityLabel} />;
  }

  if (fallbackStage === 1) {
    return <TimeyAvatar state={state} size={resolvedSize} animated={animated} glow={glow} greeting={greeting} greetingReplayNonce={greetingReplayNonce} accessibilityLabel={resolvedAccessibilityLabel} />;
  }

  return (
    <View style={[styles.wrap, { width: resolvedSize, height: resolvedSize }]} accessibilityRole="image" accessibilityLabel={resolvedAccessibilityLabel}>
      <Animated.View style={[styles.visualCanvas, motionStyle, { width: visualSize, height: visualSize }]}>
        <Image
          source={source}
          resizeMode="contain"
          onError={() => setFallbackStage(1)}
          style={{ width: visualSize, height: visualSize }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  visualCanvas: {
    alignSelf: 'center',
    overflow: 'visible',
  },
});

export const Timey3DAvatar = memo(BaseTimey3DAvatar);
