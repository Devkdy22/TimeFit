import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appColors, appTypography } from '../../theme/app-tokens';

export type AppTabKey = 'home' | 'routine' | 'mypage';

interface BottomTabBarProps {
  activeTab: AppTabKey;
  onPressTab: (tab: AppTabKey) => void;
}

const tabs: Array<{ key: AppTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'routine', label: 'Routine', icon: 'time-outline' },
  { key: 'mypage', label: 'My Page', icon: 'person-outline' },
];

export function BottomTabBar({ activeTab, onPressTab }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onPressTab(tab.key)} style={styles.tab}>
            <View style={[styles.dot, active ? styles.dotActive : null]}>
              <Ionicons name={tab.icon} size={19} color={active ? appColors.primary : appColors.textMuted} />
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 72,
    borderTopWidth: 1,
    borderColor: appColors.border,
    backgroundColor: '#FBFEFE',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tab: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 72 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: 'rgba(76, 199, 193, 0.18)',
    shadowColor: appColors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { color: appColors.textMuted, ...appTypography.small },
  labelActive: { color: appColors.primaryDark, fontWeight: '600' },
});
