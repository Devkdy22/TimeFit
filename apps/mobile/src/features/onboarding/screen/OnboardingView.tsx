import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { Character, type CharacterState } from '../../../components/character/Character';
import { BottomCTA, ScreenContainer } from '../../../components/ui';
import { theme } from '../../../theme/theme';

interface OnboardingSlide {
  id: string;
  title: string;
  body: string;
  tone: 'mint' | 'orange' | 'red';
  status: 'relaxed' | 'warning' | 'urgent';
  gradientTop: string;
  gradientBottom: string;
  titleColor: string;
  bodyColor: string;
  characterState: CharacterState;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'onboarding-1',
    title: '도착 시간에 맞춰\n알려드려요.',
    body: '출발지가 아니라 도착시간이 중심입니다.',
    tone: 'mint',
    status: 'relaxed',
    gradientTop: '#BFECEA',
    gradientBottom: '#F7FFFE',
    titleColor: '#34B6AE',
    bodyColor: '#6F8F90',
    characterState: 'idle',
  },
  {
    id: 'onboarding-2',
    title: '생각하지 않고\n행동하세요.',
    body: '지금 무엇을 해야하는지 바로 알려드려요.',
    tone: 'orange',
    status: 'warning',
    gradientTop: '#FCE3BA',
    gradientBottom: '#FFF9EF',
    titleColor: '#F59E0B',
    bodyColor: '#6F8F90',
    characterState: 'happy',
  },
  {
    id: 'onboarding-3',
    title: '상황에 맞는\n알림을 받으세요.',
    body: '여유, 주의, 긴급 상태를 실시간으로 전달합니다.',
    tone: 'red',
    status: 'urgent',
    gradientTop: '#F6C9D0',
    gradientBottom: '#FFF4F6',
    titleColor: '#EF4444',
    bodyColor: '#6F8F90',
    characterState: 'urgent',
  },
];

const LAST_INDEX = ONBOARDING_SLIDES.length - 1;

interface OnboardingViewProps {
  onPressStart: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function GradientFill({ top, bottom }: { top: string; bottom: string }) {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="onboardingGradientLayer" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={top} />
          <Stop offset="100%" stopColor={bottom} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#onboardingGradientLayer)" />
    </Svg>
  );
}

export function OnboardingView({ onPressStart }: OnboardingViewProps) {
  const [index, setIndex] = useState(0);
  const [bgFromIndex, setBgFromIndex] = useState(0);
  const entry = useRef(new Animated.Value(0)).current;
  const bgFade = useRef(new Animated.Value(1)).current;
  const slideProgress = useRef(new Animated.Value(0)).current;
  const swipeShiftX = useRef(new Animated.Value(0)).current;
  const prevIndexRef = useRef(0);

  useEffect(() => {
    entry.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(entry, {
          toValue: 0.65,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(entry, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(slideProgress, {
        toValue: index,
        duration: 380,
        easing: Easing.bezier(...theme.motion.easing.standard),
        useNativeDriver: false,
      }),
    ]).start();
  }, [entry, index, slideProgress]);

  useEffect(() => {
    const prevIndex = prevIndexRef.current;
    if (prevIndex === index) {
      return;
    }

    setBgFromIndex(prevIndex);
    bgFade.setValue(0);
    Animated.timing(bgFade, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(...theme.motion.easing.standard),
      useNativeDriver: true,
    }).start();
    prevIndexRef.current = index;
  }, [bgFade, index]);

  const slide = ONBOARDING_SLIDES[index];

  const applySwipeTransition = (dx: number) => {
    if (dx < -56) {
      setIndex((prev) => Math.min(prev + 1, LAST_INDEX));
      return;
    }
    if (dx > 56) {
      setIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) + 8,
        onPanResponderMove: (_, gestureState) => {
          swipeShiftX.setValue(clamp(gestureState.dx * 0.2, -18, 18));
        },
        onPanResponderRelease: (_, gestureState) => {
          applySwipeTransition(gestureState.dx);
          Animated.spring(swipeShiftX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeShiftX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        },
      }),
    [swipeShiftX],
  );

  const onPressNext = () => {
    if (index === LAST_INDEX) {
      onPressStart();
      return;
    }
    setIndex((prev) => prev + 1);
  };

  const titleColor = slideProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ONBOARDING_SLIDES.map((item) => item.titleColor),
  });

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={StyleSheet.absoluteFillObject}>
          <GradientFill
            top={ONBOARDING_SLIDES[bgFromIndex].gradientTop}
            bottom={ONBOARDING_SLIDES[bgFromIndex].gradientBottom}
          />
        </View>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgFade }]}>
          <GradientFill top={slide.gradientTop} bottom={slide.gradientBottom} />
        </Animated.View>
      </View>

      <Animated.View {...swipeResponder.panHandlers} style={styles.heroPanel}>
        <Animated.View
          style={[
            styles.heroInner,
            {
              opacity: entry,
              transform: [
                { translateX: swipeShiftX },
                { translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.characterZone}>
            <Character size={232} tone={slide.tone} state={slide.characterState} />
          </View>

          <View style={styles.copyArea}>
            <Animated.Text style={[styles.title, { color: titleColor }]}>
              {slide.title}
            </Animated.Text>
            <Text style={[styles.body, { color: slide.bodyColor }]}>{slide.body}</Text>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[
          styles.bottomArea,
          {
            opacity: entry,
            transform: [
              { translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.dotRow}>
          {ONBOARDING_SLIDES.map((item, dotIndex) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                dotIndex === index ? styles.dotActive : null,
                dotIndex === index ? { backgroundColor: slide.titleColor } : null,
              ]}
            />
          ))}
        </View>

        <BottomCTA
          label={index === LAST_INDEX ? '시작하기' : 'next'}
          status={slide.status}
          onPress={onPressNext}
        />
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 0,
    paddingBottom: theme.spacing.xxl,
    backgroundColor: 'transparent',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPanel: {
    flex: 1,
  },
  heroInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg,
  },
  characterZone: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 240,
    minHeight: 240,
  },
  copyArea: {
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  title: {
    ...theme.typography.title.lg,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body.md,
    textAlign: 'center',
  },
  bottomArea: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: 30,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background.elevated,
    ...theme.elevation.sm,
  },
  dotActive: {
    width: 14,
    height: 14,
  },
});
