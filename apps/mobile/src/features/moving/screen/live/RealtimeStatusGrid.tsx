import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { formatRealtimeAge, matchingConfidenceLabel, realtimeSourceLabel, realtimeStatusLabel, resolveDisplayedRealtimeStatus } from './realtimePresentation';
import { statusTone } from './ui';
import { typographyPresets } from '../../../../theme/typography';

export function RealtimeStatusGrid({ data }: { data: LiveSheetProps }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const tone = statusTone(data.status);
  const current = data.detailLines.find((line) => line.isCurrent) ?? data.detailLines[0];
  const realtimeStatus = resolveDisplayedRealtimeStatus(current?.realtimeStatus ?? 'CHECKING', current?.realtimeUpdatedAt, nowMs);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const freshness = formatRealtimeAge(current?.realtimeUpdatedAt, nowMs);
  const items = [
    { label: '상태', value: realtimeStatusLabel(realtimeStatus), icon: 'time-outline' as const },
    { label: '출처', value: realtimeSourceLabel(current?.realtimeSource), icon: 'cloud-outline' as const },
    { label: '수신 시각', value: freshness, icon: 'refresh-outline' as const },
    { label: '매칭', value: matchingConfidenceLabel(current?.matchingConfidence), icon: 'locate-outline' as const },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(90)} style={styles.wrap}>
      <Text style={styles.sectionTitle}>실시간 정보</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={styles.card}>
            <Ionicons name={item.icon} size={14} color={item.label === '상태' ? tone : '#64748B'} />
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            <Text style={[styles.value, item.label === '상태' ? { color: tone } : null]} numberOfLines={2}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionTitle: { ...typographyPresets.label, color: '#475569' },
  grid: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 2,
    alignItems: 'center',
  },
  label: { ...typographyPresets.caption.md, color: '#64748B' },
  value: { ...typographyPresets.label, color: '#0F172A', textAlign: 'center' },
});
