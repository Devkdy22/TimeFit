import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';

export function NextActionCard({ data }: { data: LiveSheetProps }) {
  const next = data.detailLines.findIndex((line) => line.isCurrent);
  const nextLine = next >= 0 ? data.detailLines[next + 1] : data.detailLines[1];
  const iconName =
    nextLine?.mode === 'bus'
      ? 'bus-outline'
      : nextLine?.mode === 'subway'
        ? 'train-outline'
        : 'walk-outline';
  return (
    <Animated.View entering={FadeInDown.duration(240).delay(30)}>
      <Pressable style={styles.card}>
        <View style={styles.icon}><Ionicons name={iconName} size={18} color="#334155" /></View>
        <View style={styles.content}>
          <Text style={styles.label}>다음 이동</Text>
          <Text style={styles.title}>{nextLine?.lineLabel ?? data.upcomingActionTitle}</Text>
          <Text style={styles.sub}>{nextLine?.stopName ?? data.upcomingActionSubtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#64748B' },
  title: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#0F172A', letterSpacing: -0.1 },
  sub: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#475569', lineHeight: 18 },
});
