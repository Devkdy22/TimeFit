import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '../constants/homeTheme';

export type GradientButtonProps = {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline' | 'soft';
  accessibilityLabel?: string;
};

export function GradientButton({
  label,
  icon,
  onPress,
  disabled = false,
  variant = 'solid',
  accessibilityLabel,
}: GradientButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.wrap, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
    >
      {variant === 'solid' ? (
        <LinearGradient colors={[colors.primary, colors.primaryPressed]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
          <View style={styles.content}>
            {icon}
            <Text style={styles.labelSolid}>{label}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.inner, variant === 'outline' ? styles.outline : styles.soft]}>
          <View style={styles.content}>
            {icon}
            <Text style={variant === 'outline' ? styles.labelOutline : styles.labelSoft}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 56,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  outline: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  soft: {
    backgroundColor: colors.primarySurface,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  labelSolid: {
    ...typography.button,
    fontFamily: 'Pretendard-ExtraBold',
    color: '#FFFFFF',
  },
  labelOutline: {
    ...typography.button,
    fontFamily: 'Pretendard-ExtraBold',
    color: colors.primaryDark,
  },
  labelSoft: {
    ...typography.button,
    fontFamily: 'Pretendard-ExtraBold',
    color: colors.primaryDark,
  },
});
