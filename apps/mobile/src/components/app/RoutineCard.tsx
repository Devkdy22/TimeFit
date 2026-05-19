import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Routine } from '../../features/routine/model/types';
import { appColors, appTypography } from '../../theme/app-tokens';
import { InfoCard } from './InfoCard';

interface RoutineCardProps {
  routine: Routine;
  onPress: () => void;
  onPressFavorite: () => void;
}

const dayLabelMap: Record<string, string> = { sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토' };

export function RoutineCard({ routine, onPress, onPressFavorite }: RoutineCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
      <InfoCard style={styles.card}>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{routine.name}</Text>
          <View style={styles.rightRow}>
            <Text style={styles.targetTime}>{routine.targetTime}</Text>
            <Pressable onPress={onPressFavorite} style={styles.iconButton}>
              <Ionicons name={routine.favorite ? 'star' : 'star-outline'} size={18} color={routine.favorite ? '#F5A623' : appColors.textMuted} />
            </Pressable>
            <Ionicons name="ellipsis-horizontal" size={18} color={appColors.textMuted} />
          </View>
        </View>

        <Text style={styles.route}>{routine.originName} {'->'} {routine.destinationName}</Text>

        <View style={styles.rowBottom}>
          <Text style={styles.meta}>{routine.repeatDays.map((d) => dayLabelMap[d]).join('·')}</Text>
          <View style={styles.notifyRow}>
            <Ionicons name={routine.notificationEnabled ? 'notifications' : 'notifications-off'} size={14} color={appColors.textSecondary} />
            <Text style={styles.meta}>{routine.notificationEnabled ? `${routine.notificationMinutesBefore}분 전` : '알림 끔'}</Text>
          </View>
        </View>
      </InfoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 102,
    paddingVertical: 16,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: appColors.textPrimary, ...appTypography.cardTitle },
  route: { marginTop: 10, color: appColors.textPrimary, ...appTypography.body },
  targetTime: { color: appColors.primaryDark, ...appTypography.cardTitle },
  meta: { color: appColors.textSecondary, ...appTypography.caption },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
});
