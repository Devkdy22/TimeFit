import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors } from '../constants/homeTheme';
import type { Routine } from '../types/home.types';

interface RoutineItemCardProps {
  routine?: Routine;
  isAdd?: boolean;
  onPress: () => void;
}

export function RoutineItemCard({ routine, isAdd = false, onPress }: RoutineItemCardProps) {
  if (isAdd) {
    return (
      <Pressable style={({ pressed }) => [styles.card, styles.addCard, { opacity: pressed ? 0.9 : 1 }]} onPress={onPress} accessibilityRole="button">
        <View style={styles.addCircle}>
          <Ionicons name="add" size={20} color={homeColors.primaryDark} />
        </View>
        <Text style={styles.addTitle}>루틴 추가</Text>
      </Pressable>
    );
  }

  if (!routine) {
    return null;
  }

  return (
    <Pressable style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1 }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.iconCircle}>
        <Ionicons name="repeat" size={16} color={homeColors.primaryDark} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{routine.name}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{routine.daysLabel}</Text>
      <Text style={styles.time}>{routine.departureTime} 출발</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 124,
    height: 136,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.surface,
    padding: 12,
  },
  addCard: {
    borderColor: homeColors.borderMint,
    backgroundColor: homeColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E7FFFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: {
    marginTop: 8,
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.primaryDark,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAFDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 10,
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textSecondary,
  },
  time: {
    marginTop: 6,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: homeColors.textTertiary,
  },
});
