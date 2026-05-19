import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { statusTone } from './ui';

export function LiveTimeline({ data }: { data: LiveSheetProps }) {
  const currentIndex = Math.max(0, data.detailLines.findIndex((line) => line.isCurrent));
  const tone = statusTone(data.status);
  const progress =
    data.detailLines.length <= 1 ? 0 : Math.max(0, Math.min(1, currentIndex / (data.detailLines.length - 1)));
  const pulse = useSharedValue(0.2);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(60)} style={styles.wrap}>
      <Text style={styles.sectionTitle}>진행 상황</Text>
      <View style={styles.row}>
        <View style={styles.baseRail} />
        <View style={[styles.activeRail, { width: `${progress * 100}%`, backgroundColor: tone }]} />
        {data.detailLines.map((line, index) => (
          <View key={line.id} style={[styles.segment, { width: `${100 / Math.max(data.detailLines.length, 2)}%` }]}>
            {index === currentIndex ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.pulseRing, { borderColor: tone }, pulseStyle]}
              />
            ) : null}
            <View
              style={[
                styles.dot,
                index < currentIndex ? styles.passed : null,
                index === currentIndex ? { backgroundColor: tone, borderColor: tone, transform: [{ scale: 1.2 }] } : null,
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={styles.label}>{data.detailLines.length}개 중 {currentIndex + 1}번째 이동 중</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9, paddingVertical: 4 },
  sectionTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#475569' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative',
    minHeight: 24,
    overflow: 'visible',
  },
  baseRail: { position: 'absolute', left: 5, right: 5, top: 11, height: 2, backgroundColor: '#E2E8F0' },
  activeRail: { position: 'absolute', left: 5, top: 11, height: 2 },
  segment: { alignItems: 'center', justifyContent: 'center', minHeight: 24, overflow: 'visible' },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#94A3B8', backgroundColor: '#FFFFFF' },
  passed: { backgroundColor: '#CBD5E1', borderColor: '#CBD5E1' },
  label: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#64748B', lineHeight: 17 },
});
