import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../constants/homeTheme';

type HomeSurfaceProps = {
  children: ReactNode;
  variant?: 'card' | 'soft' | 'plain';
  style?: StyleProp<ViewStyle>;
};

export function HomeSurface({ children, variant = 'card', style }: HomeSurfaceProps) {
  return <View style={[styles.base, variant === 'card' ? styles.card : null, variant === 'soft' ? styles.soft : null, variant === 'plain' ? styles.plain : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  soft: {
    backgroundColor: colors.primarySurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMint,
  },
  plain: {
    backgroundColor: 'transparent',
    padding: 0,
  },
});
