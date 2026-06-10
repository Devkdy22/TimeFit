import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TimeWheelPicker } from '../../../components/home/TimeWheelPicker';
import { colors, spacing, typography } from '../constants/homeTheme';
import { GradientButton } from './GradientButton';
import { HomeSurface } from './HomeSurface';

interface DepartureCalculatorCardProps {
  arrivalTime: string;
  destinationLabel: string;
  pickerVisible: boolean;
  onOpenTimePicker: () => void;
  onCloseTimePicker: () => void;
  onConfirmTime: (time: string) => void;
  onPressDestination: () => void;
  onPressCalculate: () => void;
}

export function DepartureCalculatorCard({
  arrivalTime,
  destinationLabel,
  pickerVisible,
  onOpenTimePicker,
  onCloseTimePicker,
  onConfirmTime,
  onPressDestination,
  onPressCalculate,
}: DepartureCalculatorCardProps) {
  return (
    <HomeSurface variant="card" style={styles.card}>
      <Pressable style={styles.row} onPress={onOpenTimePicker} accessibilityRole="button">
        <View style={styles.rowLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.rowLabel}>도착 시간</Text>
            <Text style={styles.timeValue}>{arrivalTime}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.row} onPress={onPressDestination} accessibilityRole="button">
        <View style={styles.rowLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="location-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.rowLabel}>어디로 가시나요?</Text>
            <Text style={[styles.destinationValue, destinationLabel === '목적지를 검색하세요' ? styles.placeholder : null]}>{destinationLabel}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </Pressable>

      <GradientButton label="출발 시간 계산하기" icon={<Ionicons name="navigate" size={18} color="#FFFFFF" />} onPress={onPressCalculate} variant="solid" />

      <TimeWheelPicker
        visible={pickerVisible}
        initialTime={arrivalTime}
        accentColor={colors.primary}
        onClose={onCloseTimePicker}
        onConfirm={onConfirmTime}
      />
    </HomeSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.caption,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textSecondary,
  },
  timeValue: {
    marginTop: spacing.xs,
    ...typography.cardTitle,
    fontFamily: 'Pretendard-ExtraBold',
    color: colors.primaryDark,
  },
  destinationValue: {
    marginTop: spacing.xs,
    ...typography.body,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textPrimary,
  },
  placeholder: {
    fontFamily: 'Pretendard-Medium',
    color: colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
