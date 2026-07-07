import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { TimeyMascot } from '../../../components/app';
import { appColors, appTypography } from '../../../theme/app-tokens';
import type { OAuthWarmupState, SocialProvider } from '../context';

interface OAuthWarmupScreenProps {
  state: OAuthWarmupState;
  onRetry: (provider: SocialProvider) => void;
  onCancel: () => void;
}

const providerCopy: Record<SocialProvider, string> = {
  google: 'Google 로그인 화면을 준비하고 있어요',
  kakao: '카카오 로그인 화면을 준비하고 있어요',
  naver: '네이버 로그인 화면을 준비하고 있어요',
};

const WARMUP_SLEEPING_SERVER_TIP = '무료 서버가 잠시 잠들어 있었나봐요. 타임이가 깨우고 있어요!';

export function OAuthWarmupScreen({ state, onRetry, onCancel }: OAuthWarmupScreenProps) {
  const bob = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressPercent = Math.max(0, Math.min(100, Math.round(state.progress * 100)));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bob, reduceMotion]);

  if (!state.visible) {
    return null;
  }

  const providerMessage = state.provider ? providerCopy[state.provider] : '로그인 화면을 준비하고 있어요';
  const mascotExpression = state.status === 'error' ? 'concerned' : state.status === 'ready' ? 'smile' : 'neutral';
  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityRole="progressbar"
      accessibilityLabel="로그인 준비 화면"
      accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
    >
      <LinearGradient colors={['#F7FFFD', '#EAF9F5', '#FFFFFF']} style={styles.container}>
        <View style={styles.ground} />

        <View style={styles.content}>
          <Animated.View style={[styles.mascotWrap, reduceMotion ? null : { transform: [{ translateY }] }]}>
            <TimeyMascot size={132} expression={mascotExpression} />
            <View style={styles.keyBubble}>
              <Text style={styles.keyText}>{state.status === 'ready' ? '✓' : '🔑'}</Text>
            </View>
          </Animated.View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>타임이가 로그인 문을 여는 중이에요</Text>
            <Text style={styles.providerText}>{providerMessage}</Text>
            <Text style={[styles.message, state.status === 'error' && styles.errorText]}>
              {state.errorMessage ?? state.message}
            </Text>
          </View>

          <View
            style={styles.progressTrack}
            accessibilityLabel={`로그인 준비 진행률 ${progressPercent}%`}
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
          >
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>{WARMUP_SLEEPING_SERVER_TIP}</Text>
          </View>

          {state.status === 'error' ? (
            <View style={styles.errorActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (state.provider) {
                    onRetry(state.provider);
                  }
                }}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>다시 시도</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>취소</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelOnlyButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  ground: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -90,
    height: 210,
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    backgroundColor: 'rgba(76,199,193,0.09)',
  },
  content: {
    alignItems: 'center',
    gap: 18,
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 156,
  },
  keyBubble: {
    position: 'absolute',
    right: 8,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#37AFA8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  keyText: {
    fontSize: 20,
    color: appColors.primaryDark,
    fontWeight: '800',
  },
  textBlock: {
    alignItems: 'center',
    gap: 7,
  },
  title: {
    textAlign: 'center',
    color: appColors.textPrimary,
    ...appTypography.screenTitle,
  },
  providerText: {
    textAlign: 'center',
    color: appColors.primaryDark,
    ...appTypography.body,
  },
  message: {
    textAlign: 'center',
    color: appColors.textSecondary,
    ...appTypography.body,
  },
  errorText: {
    color: appColors.danger,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 320,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(76,199,193,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: appColors.primary,
  },
  tipBox: {
    width: '100%',
    maxWidth: 340,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: 'rgba(255,255,255,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    flex: 1,
    color: appColors.textSecondary,
    ...appTypography.caption,
  },
  errorActions: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    ...appTypography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelOnlyButton: {
    minWidth: 120,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: appColors.textSecondary,
    ...appTypography.body,
  },
  pressed: {
    opacity: 0.82,
  },
});
