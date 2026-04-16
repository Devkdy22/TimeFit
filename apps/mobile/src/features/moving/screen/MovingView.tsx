import { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Timi } from '../../../components/timi';
import { BottomCTA, FloatingCard, StatusBadge } from '../../../components/ui';
import { getStatusAppearance } from '../../../components/ui/status-styles';
import { theme } from '../../../theme/theme';
import { MapWrapper } from '../../map/MapWrapper';
import type { MovingMapData } from '../../map/types';
import type { MovingStatusUi } from '../status-config';
import type { TimiState } from '../timi-config';

export interface MovingViewProps {
  progress: number;
  progressPercent: number;
  statusIndex: number;
  remainingDistanceText: string;
  remainingTimeText: string;
  movingStatus: MovingStatusUi;
  timiState: TimiState;
  mapData: MovingMapData;
  onPressComplete: () => void;
}

export function MovingView({
  progress,
  progressPercent,
  statusIndex,
  remainingDistanceText,
  remainingTimeText,
  movingStatus,
  timiState,
  mapData,
  onPressComplete,
}: MovingViewProps) {
  const appearance = getStatusAppearance(movingStatus.status);
  const statusTone = useSharedValue(statusIndex);
  const screenReveal = useSharedValue(0);
  const urgentPulse = useSharedValue(1);

  useEffect(() => {
    screenReveal.value = withTiming(1, {
      duration: theme.motion.duration.slow,
      easing: Easing.bezier(...theme.motion.easing.standard),
    });
  }, [screenReveal]);

  useEffect(() => {
    statusTone.value = withTiming(statusIndex, {
      duration: theme.motion.duration.statusShift,
      easing: Easing.bezier(...theme.motion.easing.standard),
    });
  }, [statusIndex, statusTone]);

  useEffect(() => {
    cancelAnimation(urgentPulse);

    if (movingStatus.status === 'urgent') {
      urgentPulse.value = withRepeat(
        withSequence(
          withTiming(1.035, {
            duration: theme.motion.duration.fast,
            easing: Easing.bezier(...theme.motion.easing.standard),
          }),
          withTiming(1, {
            duration: theme.motion.duration.normal,
            easing: Easing.bezier(...theme.motion.easing.standard),
          }),
        ),
        -1,
        false,
      );
      return;
    }

    urgentPulse.value = withTiming(1, {
      duration: theme.motion.duration.normal,
      easing: Easing.bezier(...theme.motion.easing.standard),
    });
  }, [movingStatus.status, urgentPulse]);

  const animatedBackdrop = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      statusTone.value,
      [0, 1, 2],
      ['rgba(61, 220, 151, 0.08)', 'rgba(255, 159, 67, 0.09)', 'rgba(255, 93, 115, 0.1)'],
    ),
    opacity: interpolate(screenReveal.value, [0, 1], [0, 1]),
  }));

  const animatedTopCardWrap = useAnimatedStyle(() => ({
    opacity: interpolate(screenReveal.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(screenReveal.value, [0, 1], [-18, 0]) }],
    shadowOpacity: interpolate(statusTone.value, [0, 1, 2], [0.05, 0.07, 0.1]),
  }));

  const animatedBottomCardWrap = useAnimatedStyle(() => ({
    opacity: interpolate(screenReveal.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(screenReveal.value, [0, 1], [24, 0]) }],
    shadowOpacity: interpolate(statusTone.value, [0, 1, 2], [0.05, 0.08, 0.1]),
  }));

  const animatedProgressTone = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      statusTone.value,
      [0, 1, 2],
      [theme.colors.accent.relaxed, theme.colors.accent.warning, theme.colors.accent.urgent],
    ),
  }));

  const animatedBubble = useAnimatedStyle(() => ({
    transform: [{ scale: urgentPulse.value }],
    opacity: interpolate(screenReveal.value, [0, 1], [0, 1]),
  }));

  const animatedCtaShell = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      statusTone.value,
      [0, 1, 2],
      ['rgba(61, 220, 151, 0.3)', 'rgba(255, 159, 67, 0.32)', 'rgba(255, 93, 115, 0.36)'],
    ),
    transform: [{ scale: urgentPulse.value }],
  }));

  const timiSize = movingStatus.status === 'urgent' ? 56 : movingStatus.status === 'warning' ? 50 : 46;
  const topInset = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : theme.spacing.lg;
  const bottomInset = Platform.OS === 'android' ? theme.spacing.lg : theme.spacing.xl;

  return (
    <View style={styles.container}>
      <MapWrapper
        data={mapData}
        progress={progress}
        mapHeight={540}
        style={styles.mapWrapper}
        overlay={(projected) => (
          <>
            <Animated.View pointerEvents="none" style={[styles.backdropTint, animatedBackdrop]} />

            <View style={styles.characterLayer} pointerEvents="none">
              <View
                style={[
                  styles.characterAnchor,
                  {
                    left: projected.currentPoint.x - 22,
                    top: projected.currentPoint.y - 72,
                  },
                ]}
              >
                <Timi variant={timiState.variant} movement={timiState.movement} emotion={timiState.emotion} size={timiSize} />
                <Animated.View style={[styles.timiBubbleWrap, animatedBubble]}>
                  <View style={[styles.timiBubble, { backgroundColor: appearance.softBackground }]}>
                    <Text style={[styles.timiBubbleText, { color: movingStatus.color }]}>{movingStatus.timiMessage}</Text>
                  </View>
                  <View style={[styles.timiBubbleTail, { borderTopColor: appearance.softBackground }]} />
                </Animated.View>
              </View>
            </View>

            <View style={[styles.topOverlay, { paddingTop: Math.max(theme.spacing.xxl, topInset + theme.spacing.sm) }]}>
              <Animated.View style={[styles.stateCardTone, animatedTopCardWrap]}>
                <FloatingCard status={movingStatus.status} elevation="sm" style={styles.topCard}>
                  <View style={styles.row}>
                    <StatusBadge status={movingStatus.status} label={movingStatus.badgeLabel} />
                    <Text style={styles.progressText}>진행률 {progressPercent}%</Text>
                  </View>

                  <View style={styles.primaryMetricWrap}>
                    <Text style={styles.primaryMetricLabel}>도착까지</Text>
                    <Text style={styles.primaryMetricValue}>{remainingTimeText}</Text>
                  </View>

                  <Text style={styles.subtitle}>{movingStatus.title}</Text>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressTrack}>
                      <Animated.View style={[styles.progressFill, animatedProgressTone, { width: `${progressPercent}%` }]} />
                    </View>
                    <View style={styles.progressMetaRow}>
                      <Text style={styles.progressText}>남은 거리 {remainingDistanceText}</Text>
                      <Text style={styles.progressText}>{movingStatus.subtitle}</Text>
                    </View>
                  </View>
                </FloatingCard>
              </Animated.View>
            </View>

            <View style={[styles.bottomOverlay, { paddingBottom: bottomInset }]}>
              <Animated.View style={[styles.actionCardWrap, animatedBottomCardWrap]}>
                <FloatingCard status={movingStatus.status} elevation="md" style={styles.bottomCard}>
                  <Text style={styles.nextActionLabel}>지금 해야 할 행동</Text>
                  <Text style={styles.nextActionText}>{movingStatus.nextActionText}</Text>

                  <Animated.View style={[styles.ctaShell, animatedCtaShell]}>
                    <BottomCTA label={movingStatus.ctaLabel} status={movingStatus.status} onPress={onPressComplete} />
                  </Animated.View>
                </FloatingCard>
              </Animated.View>
            </View>
          </>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: theme.radius.none,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
  },
  characterLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  characterAnchor: {
    position: 'absolute',
    alignItems: 'center',
    gap: theme.spacing.xxs,
  },
  timiBubbleWrap: {
    alignItems: 'center',
  },
  timiBubble: {
    maxWidth: 220,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  timiBubbleTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  timiBubbleText: {
    ...theme.typography.caption.md,
  },
  topOverlay: {
    paddingHorizontal: theme.spacing.lg,
  },
  stateCardTone: {
    borderRadius: theme.radius.xl,
    borderWidth: theme.border.thin,
    ...theme.elevation.md,
  },
  topCard: {
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: theme.border.none,
    padding: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  primaryMetricWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  primaryMetricLabel: {
    ...theme.typography.body.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  primaryMetricValue: {
    ...theme.typography.title.xl,
    color: theme.colors.text.primary,
  },
  subtitle: {
    ...theme.typography.body.md,
    color: theme.colors.text.primary,
  },
  progressBlock: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(11, 18, 32, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.full,
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  progressText: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
    flexShrink: 1,
  },
  bottomOverlay: {
    paddingHorizontal: theme.spacing.lg,
  },
  actionCardWrap: {
    ...theme.elevation.lg,
  },
  bottomCard: {
    gap: theme.spacing.md,
    borderWidth: theme.border.none,
    padding: theme.spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  nextActionLabel: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
  nextActionText: {
    ...theme.typography.title.lg,
    color: theme.colors.text.primary,
  },
  ctaShell: {
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xxs,
  },
});
