import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { homeColors, homeLayout } from '../constants/homeTheme';

interface LoggedInAlertCardProps {
  hasRoutine: boolean;
  onPressAction: () => void;
}

export function LoggedInAlertCard({ hasRoutine, onPressAction }: LoggedInAlertCardProps) {
  return (
    <Pressable style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1 }]} onPress={onPressAction} accessibilityRole="button">
      <View style={styles.iconWrap}>
        <Ionicons name="notifications-outline" size={18} color={homeColors.primaryDark} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{hasRoutine ? '출발 알림을 켜두면 더 여유로워요' : '루틴을 만들면 알림도 받을 수 있어요'}</Text>
        <Text style={styles.desc}>{hasRoutine ? '저장한 루틴에 맞춰 출발 시간을 알려드릴게요.' : '반복 이동을 저장하고 출발 시간을 놓치지 마세요.'}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.action}>{hasRoutine ? '알림 설정' : '루틴 만들기'}</Text>
        <Ionicons name="chevron-forward" size={16} color={homeColors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    borderRadius: homeLayout.smallCardRadius,
    borderWidth: 1,
    borderColor: homeColors.borderMint,
    backgroundColor: homeColors.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAFFFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: homeColors.textPrimary,
  },
  desc: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: homeColors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  action: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    color: homeColors.primaryDark,
  },
});
