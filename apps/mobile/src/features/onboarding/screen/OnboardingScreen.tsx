import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { theme } from '../../../theme/theme';
import { OnboardingView } from './OnboardingView';
import { useNavigationHelper } from '../../../utils/navigation';

export function OnboardingScreen() {
  const nav = useNavigationHelper();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: theme.motion.duration.slow,
        easing: Easing.bezier(...theme.motion.easing.standard),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: theme.motion.duration.slow,
        easing: Easing.bezier(...theme.motion.easing.standard),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const animatedStyle = {
    opacity,
    transform: [{ translateY }],
  };

  return <OnboardingView animatedStyle={animatedStyle} onPressStart={nav.replaceToHome} />;
}
