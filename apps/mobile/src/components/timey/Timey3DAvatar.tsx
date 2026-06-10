import { memo, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { TimeyProps, TimeyState } from '../../types/timey.types';
import { getTimeyAccessibilityLabel } from './TimeyController';
import { TimeyAvatar } from './TimeyAvatar';
import confidentAsset from '../../../assets/characters/timey/3d/confident.png';
import idleAsset from '../../../assets/characters/timey/3d/idle.png';
import lateAsset from '../../../assets/characters/timey/3d/late.png';
import offrouteAsset from '../../../assets/characters/timey/3d/offroute.png';
import panicAsset from '../../../assets/characters/timey/3d/panic.png';
import reroutingAsset from '../../../assets/characters/timey/3d/rerouting.png';
import ridingBusAsset from '../../../assets/characters/timey/3d/riding_bus.png';
import ridingSubwayAsset from '../../../assets/characters/timey/3d/riding_subway.png';
import searchingAsset from '../../../assets/characters/timey/3d/searching.png';
import successAsset from '../../../assets/characters/timey/3d/success.png';
import transferAsset from '../../../assets/characters/timey/3d/transfer.png';
import urgentAsset from '../../../assets/characters/timey/3d/urgent.png';
import waitingAsset from '../../../assets/characters/timey/3d/waiting.png';
import walkingAsset from '../../../assets/characters/timey/3d/walking.png';
import warningAsset from '../../../assets/characters/timey/3d/warning.png';

const ASSETS_3D: Record<TimeyState, number> = {
  idle: idleAsset,
  searching: searchingAsset,
  confident: confidentAsset,
  waiting: waitingAsset,
  walking: walkingAsset,
  riding_bus: ridingBusAsset,
  riding_subway: ridingSubwayAsset,
  transfer: transferAsset,
  warning: warningAsset,
  urgent: urgentAsset,
  panic: panicAsset,
  offroute: offrouteAsset,
  rerouting: reroutingAsset,
  success: successAsset,
  late: lateAsset,
};

export const TIMEY_3D_ASSET_PATHS: Record<TimeyState, string> = {
  idle: 'assets/characters/timey/3d/idle.png',
  searching: 'assets/characters/timey/3d/searching.png',
  confident: 'assets/characters/timey/3d/confident.png',
  waiting: 'assets/characters/timey/3d/waiting.png',
  walking: 'assets/characters/timey/3d/walking.png',
  riding_bus: 'assets/characters/timey/3d/riding_bus.png',
  riding_subway: 'assets/characters/timey/3d/riding_subway.png',
  transfer: 'assets/characters/timey/3d/transfer.png',
  warning: 'assets/characters/timey/3d/warning.png',
  urgent: 'assets/characters/timey/3d/urgent.png',
  panic: 'assets/characters/timey/3d/panic.png',
  offroute: 'assets/characters/timey/3d/offroute.png',
  rerouting: 'assets/characters/timey/3d/rerouting.png',
  success: 'assets/characters/timey/3d/success.png',
  late: 'assets/characters/timey/3d/late.png',
};

function resolve3DAssetSize(state: TimeyState) {
  const src = Image.resolveAssetSource(ASSETS_3D[state] ?? ASSETS_3D.idle);
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

function BaseTimey3DAvatar({ state = 'idle', size = 'md', accessibilityLabel, animated, glow }: TimeyProps) {
  const resolvedSize = resolveSize(size);
  const resolvedAccessibilityLabel = accessibilityLabel ?? getTimeyAccessibilityLabel(state);
  const [fallbackStage, setFallbackStage] = useState<0 | 1>(0);

  useEffect(() => {
    setFallbackStage(0);
  }, [state]);

  const source = useMemo(() => ASSETS_3D[state] ?? ASSETS_3D.idle, [state]);

  if (fallbackStage === 1) {
    return <TimeyAvatar state={state} size={resolvedSize} animated={animated} glow={glow} accessibilityLabel={resolvedAccessibilityLabel} />;
  }

  return (
    <View style={[styles.wrap, { width: resolvedSize, height: resolvedSize }]} accessibilityRole="image" accessibilityLabel={resolvedAccessibilityLabel}>
      <Image
        source={source}
        resizeMode="contain"
        onError={() => setFallbackStage(1)}
        style={{ width: resolvedSize, height: resolvedSize }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const Timey3DAvatar = memo(BaseTimey3DAvatar);
