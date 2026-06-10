import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Timey } from '../../../components/timey';
import type { TimeyState } from '../../../domain/timey/timeyTypes';
import { getTimeyAccessibilityLabel } from '../../../components/timey/TimeyController';
import { colors, spacing, typography } from '../constants/homeTheme';

interface HomeHeroProps {
  userName?: string;
  timeyState: TimeyState;
}

const { width } = Dimensions.get('window');
const isSmall = width <= 360;

export function HomeHero({ userName, timeyState }: HomeHeroProps) {
  return (
    <LinearGradient colors={[colors.backgroundTop, colors.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.eyebrow}>안녕하세요{userName ? `, ${userName}님!` : '!'}</Text>
        <Text style={[styles.title, isSmall ? styles.titleSmall : null]} numberOfLines={2}>
          몇 시까지 도착해야 하나요?
        </Text>
        <Text style={styles.subtitle}>원하는 도착 시간을 입력하면 지금 출발해야 할 시간을 알려드릴게요.</Text>
      </View>
      <View style={styles.mascotWrap}>
        <Timey
          state={timeyState}
          animated
          glow
          size={isSmall ? 'md' : 'lg'}
          animationMode="static"
          accessibilityLabel={getTimeyAccessibilityLabel(timeyState)}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 220,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
    maxWidth: '72%',
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.heroEyebrow,
    fontFamily: 'Pretendard-Bold',
    color: colors.primaryDark,
  },
  title: {
    ...typography.heroTitle,
    fontFamily: 'Pretendard-ExtraBold',
    color: colors.textPrimary,
  },
  titleSmall: {
    fontSize: 27,
    lineHeight: 34,
  },
  subtitle: {
    ...typography.heroSubtitle,
    fontFamily: 'Pretendard-Medium',
    color: colors.textSecondary,
  },
  mascotWrap: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    opacity: isSmall ? 0.9 : 1,
  },
});
