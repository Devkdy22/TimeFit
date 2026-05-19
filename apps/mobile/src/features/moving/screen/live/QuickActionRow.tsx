import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export function QuickActionRow() {
  const actions = [
    { icon: 'locate-outline', label: '위치 재보정' },
    { icon: 'refresh-outline', label: '경로 재탐색' },
    { icon: 'share-social-outline', label: '공유' },
    { icon: 'alert-circle-outline', label: '신고' },
  ] as const;

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(120)} style={styles.wrap}>
      <Text style={styles.sectionTitle}>빠른 액션</Text>
      <View style={styles.row}>
        {actions.map((a) => (
          <Pressable key={a.label} style={styles.item}>
            <View style={styles.icon}>
              <Ionicons name={a.icon} size={18} color="#334155" />
            </View>
            <Text style={styles.label}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  sectionTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#475569' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Pretendard-Medium', fontSize: 11, color: '#64748B' },
});
