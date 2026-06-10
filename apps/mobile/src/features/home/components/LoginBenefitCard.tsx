import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { GradientButton } from './GradientButton';
import { HomeSurface } from './HomeSurface';
import { colors, radius, spacing, typography } from '../constants/homeTheme';

interface LoginBenefitCardProps {
  onPressLogin: () => void;
}

const benefits = [
  { icon: 'calendar-outline' as const, title: '루틴 저장', description: '출근·퇴근처럼 반복되는 이동을 저장해요.' },
  { icon: 'notifications-outline' as const, title: '출발 알림', description: '원하는 시간에 맞춰 미리 알려드려요.' },
  { icon: 'map-outline' as const, title: '장소 저장', description: '자주 가는 목적지를 빠르게 선택해요.' },
] as const;

export function LoginBenefitCard({ onPressLogin }: LoginBenefitCardProps) {
  return (
    <HomeSurface variant="soft" style={styles.card}>
      <Text style={styles.title}>로그인하면 더 편리해져요</Text>
      <Text style={styles.subtitle}>저장과 알림 기능으로 반복 이동을 더 쉽게 관리할 수 있어요.</Text>

      <View style={styles.list}>
        {benefits.map((item) => (
          <View key={item.title} style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.texts}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDesc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <GradientButton label="로그인하고 더 편리하게 사용하기" onPress={onPressLogin} variant="outline" />

      <View style={styles.noteRow}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.note}>로그인하지 않아도 출발 시간 계산은 바로 사용할 수 있어요.</Text>
      </View>
    </HomeSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.cardTitle,
    fontFamily: 'Pretendard-ExtraBold',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    fontFamily: 'Pretendard-Medium',
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    fontFamily: 'Pretendard-Bold',
    color: colors.textPrimary,
  },
  rowDesc: {
    marginTop: 2,
    ...typography.caption,
    fontFamily: 'Pretendard-Medium',
    color: colors.textSecondary,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  note: {
    flex: 1,
    ...typography.caption,
    fontFamily: 'Pretendard-Medium',
    color: colors.textTertiary,
  },
});
