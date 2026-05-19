import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { statusTone } from './ui';

export function RealtimeStatusGrid({ data }: { data: LiveSheetProps }) {
  const tone = statusTone(data.status);
  const items = [
    { label: '지연', value: '정시 운행 중', icon: 'time-outline' as const },
    { label: '혼잡', value: '확인 중', icon: 'people-outline' as const },
    { label: '위치', value: '실시간 반영 중', icon: 'locate-outline' as const },
    { label: '정확도', value: data.status === 'urgent' ? '주의' : '좋음', icon: 'checkmark-circle-outline' as const },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(90)} style={styles.wrap}>
      <Text style={styles.sectionTitle}>실시간 정보</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.label} style={styles.card}>
            <Ionicons name={item.icon} size={14} color={item.label === '지연' ? tone : '#64748B'} />
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            <Text style={[styles.value, item.label === '지연' ? { color: tone } : null]} numberOfLines={2}>
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
  sectionTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#475569' },
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
  label: { fontFamily: 'Pretendard-Medium', fontSize: 11, color: '#94A3B8' },
  value: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#0F172A', lineHeight: 14, textAlign: 'center' },
});
