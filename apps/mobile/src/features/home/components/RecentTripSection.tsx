import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors, homeLayout, homeShadow } from '../constants/homeTheme';
import type { RecentTrip } from '../types/home.types';
import { RecentTripItem } from './RecentTripItem';

interface RecentTripSectionProps {
  items: RecentTrip[];
  onPressAll: () => void;
  onPressItem: (item: RecentTrip) => void;
}

export function RecentTripSection({ items, onPressAll, onPressItem }: RecentTripSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>최근 이동 기록</Text>
        <Pressable onPress={onPressAll} accessibilityRole="button">
          <Text style={styles.action}>전체 보기</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {items.slice(0, 3).map((item) => (
          <RecentTripItem key={item.id} item={item} onPress={() => onPressItem(item)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 19,
    color: homeColors.textPrimary,
  },
  action: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: homeColors.primaryDark,
  },
  card: {
    borderRadius: homeLayout.cardRadius,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: 12,
    gap: 8,
    ...homeShadow,
  },
});
