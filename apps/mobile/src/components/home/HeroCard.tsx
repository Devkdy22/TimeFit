import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface HeroCardProps {
  name: string;
  greeting?: string;
  title?: string;
  character?: ReactNode;
}

export function HeroCard({ name, greeting, title, character }: HeroCardProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -4,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [bob]);

  return (
    <View style={styles.container}>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#F2FBFA" stopOpacity="0.92" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGradient)" rx="24" ry="24" />
      </Svg>

      <Animated.View style={[styles.characterWrap, { transform: [{ translateY: bob }] }]}>
        {character ?? <View style={styles.characterPlaceholder} />}
      </Animated.View>

      <Text style={styles.greeting}>{greeting ?? `안녕하세요 ${name}님,`}</Text>
      <Text style={styles.title}>{title ?? '준비되셨나요?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(88, 199, 194, 0.18)',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  characterWrap: {
    marginBottom: 12,
  },
  characterPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
  },
  greeting: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  title: {
    marginTop: 6,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 44,
    lineHeight: 52,
    color: colors.textPrimary,
  },
});
