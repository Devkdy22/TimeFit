import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors, homeLayout } from '../constants/homeTheme';

interface GuestLoginBenefitCardProps {
  onPressLogin: () => void;
}

const benefits = [
  { icon: 'calendar-outline', title: '루틴 저장', description: '출근·퇴근처럼 반복되는 이동을 저장해요.' },
  { icon: 'notifications-outline', title: '출발 알림', description: '원하는 시간에 맞춰 미리 알려드려요.' },
  { icon: 'star-outline', title: '장소 저장', description: '자주 가는 목적지를 빠르게 선택해요.' },
] as const;

export function GuestLoginBenefitCard({ onPressLogin }: GuestLoginBenefitCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>로그인하면 더 편리해져요</Text>
      <Text style={styles.subtitle}>저장과 알림 기능으로 반복 이동을 더 쉽게 관리할 수 있어요.</Text>

      <View style={styles.benefitList}>
        {benefits.map((benefit) => (
          <View key={benefit.title} style={styles.benefitRow}>
            <View style={styles.iconCircle}>
              <Ionicons name={benefit.icon} size={18} color={homeColors.primaryDark} />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitTitle}>{benefit.title}</Text>
              <Text style={styles.benefitDesc}>{benefit.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]} onPress={onPressLogin} accessibilityRole="button">
        <Text style={styles.ctaText}>로그인하고 더 편리하게 사용하기</Text>
      </Pressable>

      <Text style={styles.footnote}>로그인하지 않아도 출발 시간 계산은 바로 사용할 수 있어요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: homeLayout.cardRadius,
    backgroundColor: homeColors.primarySurface,
    borderWidth: 1,
    borderColor: homeColors.borderMint,
    padding: 16,
    gap: 8,
  },
  headline: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 17,
    color: homeColors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: homeColors.textSecondary,
  },
  benefitList: {
    marginTop: 6,
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E9FFFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: { flex: 1 },
  benefitTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.textPrimary,
  },
  benefitDesc: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textSecondary,
  },
  cta: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.primary,
    backgroundColor: '#EEFFFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 14,
    color: homeColors.primaryDark,
  },
  footnote: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textSecondary,
  },
});
