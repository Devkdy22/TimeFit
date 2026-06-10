import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { homeColors } from '../constants/homeTheme';
import type { Routine } from '../types/home.types';
import { EmptyRoutineCard } from './EmptyRoutineCard';
import { RoutineItemCard } from './RoutineItemCard';

interface RoutineSectionProps {
  routines: Routine[];
  onPressAll: () => void;
  onPressRoutine: (routine: Routine) => void;
  onPressAddRoutine: () => void;
  onPressSearchOnly: () => void;
}

export function RoutineSection({
  routines,
  onPressAll,
  onPressRoutine,
  onPressAddRoutine,
  onPressSearchOnly,
}: RoutineSectionProps) {
  const hasRoutines = routines.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>내 루틴</Text>
        {hasRoutines ? (
          <Pressable onPress={onPressAll} accessibilityRole="button">
            <Text style={styles.actionText}>전체 보기</Text>
          </Pressable>
        ) : null}
      </View>

      {hasRoutines ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listRow}>
          {routines.map((routine) => (
            <RoutineItemCard key={routine.id} routine={routine} onPress={() => onPressRoutine(routine)} />
          ))}
          <RoutineItemCard isAdd onPress={onPressAddRoutine} />
        </ScrollView>
      ) : (
        <EmptyRoutineCard onPressCreate={onPressAddRoutine} onPressSearchOnly={onPressSearchOnly} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 19,
    color: homeColors.textPrimary,
  },
  actionText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: homeColors.primaryDark,
  },
  listRow: {
    gap: 10,
    paddingRight: 8,
  },
});
