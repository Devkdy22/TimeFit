import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { theme } from '../../../theme/theme';
import type { UiStatus } from '../../../theme/status-config';
import type { RoutineItem } from '../../../mocks/route/types';

export interface RoutineViewProps {
  routineItems: RoutineItem[];
  checkedIds: string[];
  completedCount: number;
  allCompleted: boolean;
  status: UiStatus;
  onToggleChecked: (id: string) => void;
  onSaveRoutine: () => void;
}

export function RoutineView({
  routineItems,
  checkedIds,
  completedCount,
  allCompleted,
  status,
  onToggleChecked,
  onSaveRoutine,
}: RoutineViewProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="루틴" subtitle="출발 전에 해야 할 준비를 체크" status={status} />

      <View style={styles.summaryRow}>
        <StatusBadge status={status} label={`${completedCount}/${routineItems.length} 완료`} />
        <Text style={styles.summaryText}>{allCompleted ? '출발 준비 완료' : '남은 항목을 체크하세요'}</Text>
      </View>

      <View style={styles.list}>
        {routineItems.map((item) => {
          const checked = checkedIds.includes(item.id);

          return (
            <Pressable
              key={item.id}
              onPress={() => onToggleChecked(item.id)}
              style={({ pressed }) => [
                styles.row,
                checked ? styles.rowChecked : null,
                { opacity: pressed ? 0.86 : 1 },
              ]}
            >
              <View style={[styles.check, checked ? styles.checkOn : null]} />
              <View style={styles.copy}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.hint}>{item.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <BottomCTA label="루틴 저장" status="warning" onPress={onSaveRoutine} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  summaryText: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    minHeight: 72,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.elevation.sm,
  },
  rowChecked: {
    backgroundColor: 'rgba(61, 220, 151, 0.12)',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.background.surface,
  },
  checkOn: {
    backgroundColor: theme.colors.accent.relaxed,
    borderColor: theme.colors.accent.relaxed,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  hint: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
});
