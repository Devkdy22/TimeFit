import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useNavigationHelper } from '../utils/navigation';
import { colors, layout, radius, shadows, spacing, typography } from '../features/home/constants/homeTheme';

type TabKey = 'routine' | 'home' | 'settings';

interface BlurViewProps {
  tint?: 'light' | 'dark' | 'default';
  intensity?: number;
  style?: object;
}

function getBlurView() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-blur') as { BlurView?: ComponentType<BlurViewProps> };
    return module.BlurView ?? null;
  } catch {
    return null;
  }
}

const BlurView = getBlurView();

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPath: (pathname: string) => boolean;
}> = [
  { key: 'routine', label: '루틴', icon: 'calendar-outline', onPath: (pathname) => pathname.startsWith('/re-engagement/routines') || pathname.startsWith('/re-engagement/routine-create') },
  { key: 'home', label: '홈', icon: 'home-outline', onPath: (pathname) => pathname.startsWith('/before-start/home') || pathname.startsWith('/before-start/search') },
  { key: 'settings', label: '설정', icon: 'settings-outline', onPath: (pathname) => pathname.startsWith('/re-engagement/settings') },
];

export function CustomBottomTabBar() {
  const nav = useNavigationHelper();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const handlers: Record<TabKey, () => void> = {
    routine: nav.goToRoutines,
    home: nav.goToHome,
    settings: nav.goToSettings,
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + layout.tabFloatingOffset }]}> 
      <View style={styles.container}>
        {BlurView ? <BlurView tint="light" intensity={22} style={StyleSheet.absoluteFillObject} /> : null}
        <View style={styles.row}>
          {TABS.map((tab) => {
            const focused = tab.onPath(pathname);
            return <TabItem key={tab.key} label={tab.label} icon={tab.icon} isFocused={focused} onPress={handlers[tab.key]} />;
          })}
        </View>
      </View>
    </View>
  );
}

function TabItem({
  label,
  icon,
  isFocused,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const indicatorOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    indicatorOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [indicatorOpacity, isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 140 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 180 });
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={`${label} 탭`}
      style={styles.tabHit}
    >
      <Animated.View style={[styles.tabItem, animatedStyle]}>
        <Ionicons name={isFocused ? icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : icon} size={22} color={isFocused ? colors.tabActive : colors.tabInactive} />
        <Text style={[styles.tabLabel, { color: isFocused ? colors.tabActive : colors.tabInactive }]} numberOfLines={1}>{label}</Text>
        <View style={styles.indicatorSlot}>
          <Animated.View style={[styles.indicator, indicatorStyle, { backgroundColor: colors.tabActive }]} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 30,
  },
  container: {
    height: layout.tabBarHeight,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.tabBorder,
    backgroundColor: colors.tabSurface,
    overflow: 'hidden',
    ...shadows.tab,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: spacing.sm,
  },
  tabHit: {
    flex: 1,
    minHeight: 56,
  },
  tabItem: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    ...typography.tabLabel,
    fontFamily: 'Pretendard-Bold',
    fontSize: 11.5,
    marginTop: 4,
  },
  indicatorSlot: {
    marginTop: 4,
    height: 4,
    justifyContent: 'center',
  },
  indicator: {
    width: 18,
    height: 4,
    borderRadius: radius.pill,
  },
});
