import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appColors, appTypography } from '../../theme/app-tokens';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onPressBack?: () => void;
  rightAction?: ReactNode;
}

export function Header({ title, subtitle, onPressBack, rightAction }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onPressBack}
          style={({ pressed }) => [styles.backButton, { opacity: onPressBack ? (pressed ? 0.7 : 1) : 0 }]}
          disabled={!onPressBack}
        >
          <Ionicons name="chevron-back" size={22} color={appColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rightArea}>{rightAction}</View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightArea: { minWidth: 44, alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', color: appColors.textPrimary, ...appTypography.sectionTitle },
  subtitle: { color: appColors.textSecondary, ...appTypography.caption },
});
