import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/homeTheme';

export function GuestNoticeCard() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>참고하세요</Text>
        <Text style={styles.body}>비로그인 상태에서는 루틴 저장, 장소 저장, 출발 알림 기능을 사용할 수 없어요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.caption,
    fontFamily: 'Pretendard-Bold',
    color: colors.textPrimary,
  },
  body: {
    marginTop: 2,
    ...typography.caption,
    fontFamily: 'Pretendard-Medium',
    color: colors.textSecondary,
  },
});
