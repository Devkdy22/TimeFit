import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors, homeLayout } from '../constants/homeTheme';

interface EmptyRoutineCardProps {
  onPressCreate: () => void;
  onPressSearchOnly: () => void;
}

export function EmptyRoutineCard({ onPressCreate, onPressSearchOnly }: EmptyRoutineCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="calendar-outline" size={22} color={homeColors.primaryDark} />
      </View>
      <Text style={styles.title}>아직 저장한 루틴이 없어요</Text>
      <Text style={styles.description}>자주 가는 이동을 루틴으로 저장하면 다음부터 출발 시간을 더 빠르게 확인할 수 있어요.</Text>

      <View style={styles.benefits}>
        <Text style={styles.benefit}>• 반복 이동 저장</Text>
        <Text style={styles.benefit}>• 출발 알림 설정</Text>
      </View>

      <Pressable style={({ pressed }) => [styles.primaryCta, { opacity: pressed ? 0.9 : 1 }]} onPress={onPressCreate} accessibilityRole="button">
        <Text style={styles.primaryCtaText}>첫 루틴 만들기</Text>
      </Pressable>
      <Pressable style={styles.secondaryTextBtn} onPress={onPressSearchOnly} accessibilityRole="button">
        <Text style={styles.secondaryText}>지금은 목적지만 검색하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: homeLayout.cardRadius,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: homeColors.borderMint,
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: homeColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: homeColors.textPrimary,
  },
  description: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 19,
    color: homeColors.textSecondary,
  },
  benefits: {
    gap: 2,
  },
  benefit: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textTertiary,
  },
  primaryCta: {
    marginTop: 4,
    minHeight: 46,
    width: '100%',
    borderRadius: 14,
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryTextBtn: {
    minHeight: 30,
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: homeColors.primaryDark,
  },
});
