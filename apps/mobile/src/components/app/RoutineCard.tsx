import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Routine } from '../../features/routine/model/types';
import { appColors, appTypography } from '../../theme/app-tokens';
import { InfoCard } from './InfoCard';

interface RoutineCardProps {
  routine: Routine;
  onPress: () => void;
  onPressFavorite: () => void;
  onPressMore: () => void;
}

const dayLabelMap: Record<string, string> = { sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토' };

export function RoutineCard({ routine, onPress, onPressFavorite, onPressMore }: RoutineCardProps) {
  const weeklyCount = routine.repeatDays.length;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
      <InfoCard style={styles.card}>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{routine.name}</Text>
          <View style={styles.rightRow}>
            <Pressable onPress={onPressFavorite} style={styles.iconButton}>
              <Ionicons name={routine.favorite ? 'star' : 'star-outline'} size={18} color={routine.favorite ? '#F5A623' : appColors.textMuted} />
            </Pressable>
            <Pressable onPress={onPressMore} style={styles.iconButton}>
              <Ionicons name="ellipsis-horizontal" size={18} color={appColors.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.routeInline}>
            <Text style={styles.route}>{routine.originName}</Text>
            <Ionicons name="arrow-forward" size={15} color="#5E7D7B" />
            <Text style={styles.route}>{routine.destinationName}</Text>
          </View>
          <View style={styles.timeWrap}>
            <Text style={styles.targetTime}>{routine.targetTime}</Text>
            <Text style={styles.frequencyText}>주 {weeklyCount}회</Text>
          </View>
        </View>

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
    minHeight: 106,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EFEE',
    shadowColor: '#132E2E',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  routeInline: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: {
    color: '#1B4E4A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  route: { color: appColors.textPrimary, fontSize: 30 / 2, fontWeight: '800' },
  timeWrap: { alignItems: 'flex-end', gap: 3 },
  targetTime: { color: appColors.primaryDark, fontSize: 28 / 2, fontWeight: '800' },
  frequencyText: { color: '#6E8585', ...appTypography.small },
  meta: { color: appColors.textSecondary, ...appTypography.caption },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
});
