import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { statusPrimary, statusTone } from './ui';

interface Props {
  expanded: boolean;
  onToggle: () => void;
  data: LiveSheetProps;
}

export function HeroStatusCard({ expanded, onToggle, data }: Props) {
  const tone = statusTone(data.status);
  if (!expanded) {
    return (
      <Pressable style={styles.collapsed} onPress={onToggle}>
        <Text style={styles.collapsedTime}>{data.arrivalTime}</Text>
        <Ionicons name="chevron-down" size={14} color="#334155" />
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.time}>{data.arrivalTime}</Text>
        <Text style={styles.label}>도착 예정</Text>
        <Pressable onPress={onToggle} style={styles.toggle}>
          <Ionicons name="chevron-up" size={16} color="#334155" />
        </Pressable>
      </View>
      <View style={[styles.badge, { backgroundColor: `${tone}1A` }]}>
        <Text style={[styles.badgeText, { color: tone }]}>{statusPrimary(data.status)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>출발 {data.currentTime}</Text>
        <Text style={styles.meta}>도착 예정 {data.arrivalTime}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '88%',
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  time: { fontFamily: 'Pretendard-ExtraBold', fontSize: 40, lineHeight: 42, color: '#0F172A' },
  label: { fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#334155', marginBottom: 5 },
  toggle: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { fontFamily: 'Pretendard-Bold', fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#64748B' },
  collapsed: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignSelf: 'flex-end',
    marginRight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  collapsedTime: { fontFamily: 'Pretendard-Bold', fontSize: 12, color: '#0F172A' },
});
