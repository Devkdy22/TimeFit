import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { statusPrimary, statusTone, stripPlusDuration } from './ui';

export function CurrentSegmentCard({ data }: { data: LiveSheetProps }) {
  const current = data.detailLines.find((line) => line.isCurrent) ?? data.detailLines[0];
  const currentIndex = Math.max(0, data.detailLines.findIndex((line) => line.isCurrent));
  const fromName = current?.stopName ?? '현재 위치';
  const toName = data.detailLines[Math.min(data.detailLines.length - 1, currentIndex + 1)]?.stopName ?? '다음 지점';
  const actionText = current?.mode === 'bus' ? '버스 탑승 이동' : current?.mode === 'subway' ? '지하철 탑승 이동' : '도보 이동';
  const tone = statusTone(data.status);
  const glow = useSharedValue(0.35);
  useEffect(() => {
    glow.value = withRepeat(withTiming(0.9, { duration: 1100 }), -1, true);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value * 0.35,
    shadowColor: tone,
    shadowRadius: 12 + glow.value * 8,
    elevation: 4 + glow.value * 2,
  }));
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>현재 이동</Text>
        <Animated.View style={[styles.statusChip, { backgroundColor: `${tone}14`, borderColor: `${tone}55` }, glowStyle]}>
          <Text style={[styles.statusChipText, { color: tone }]}>{statusPrimary(data.status)}</Text>
        </Animated.View>
      </View>
      <Text style={styles.title}>{current?.lineLabel ?? '이동 중'}</Text>
      <Text style={styles.route}>{fromName} → {toName}</Text>
      <Text style={styles.action}>{actionText}</Text>
      <Text style={[styles.eta, { color: tone }]}>{stripPlusDuration(current?.etaText ?? data.remainingTime)} 남음</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 7,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#64748B' },
  title: { fontFamily: 'Pretendard-ExtraBold', fontSize: 23, color: '#0F172A', letterSpacing: -0.25 },
  route: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#334155', lineHeight: 20 },
  action: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#64748B' },
  eta: { fontFamily: 'Pretendard-Bold', fontSize: 18, letterSpacing: -0.2 },
  statusChip: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12 },
});
