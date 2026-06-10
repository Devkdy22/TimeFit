import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors } from '../constants/homeTheme';
import type { RecentTrip } from '../types/home.types';

interface RecentTripItemProps {
  item: RecentTrip;
  onPress: () => void;
}

const iconByType = {
  subway: 'train-outline',
  bus: 'bus-outline',
  place: 'location-outline',
} as const;

export function RecentTripItem({ item, onPress }: RecentTripItemProps) {
  return (
    <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.left}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconByType[item.type]} size={17} color={homeColors.primaryDark} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle ?? item.usedAtLabel}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.usedAt}>{item.usedAtLabel}</Text>
        <Ionicons name="chevron-forward" size={15} color={homeColors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FBFEFE',
    borderWidth: 1,
    borderColor: homeColors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: homeColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.textPrimary,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 6,
  },
  usedAt: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    color: homeColors.textTertiary,
  },
});
