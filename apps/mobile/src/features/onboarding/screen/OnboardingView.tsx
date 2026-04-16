import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Timi } from '../../../components/character/Timi';
import { BottomCTA, ScreenContainer } from '../../../components/ui';
import { theme } from '../../../theme/theme';

export interface OnboardingViewProps {
  animatedStyle: StyleProp<ViewStyle>;
  onPressStart: () => void;
}

export function OnboardingView({ animatedStyle, onPressStart }: OnboardingViewProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.center}>
          <Timi tone="mint" size={104} />
        </View>

        <View style={styles.copyArea}>
          <Text style={styles.title}>늦지 않게, 지금 할 행동만 알려줄게요.</Text>
          <Text style={styles.body}>도착 시간보다 먼저, 지금 움직이면 됩니다.</Text>
        </View>
      </Animated.View>

      <BottomCTA label="시작하기" status="relaxed" onPress={onPressStart} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.xxxl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.xxl,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyArea: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  title: {
    ...theme.typography.title.lg,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
