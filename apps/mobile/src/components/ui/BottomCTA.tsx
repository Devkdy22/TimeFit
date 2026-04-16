import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';
import { uiTheme, type StatusTone } from '../../constants/theme';

export interface BottomCTAProps extends Omit<BaseUiProps, 'children'> {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: StatusTone;
}

function mapStatusToTone(status: NonNullable<BaseUiProps['status']>): StatusTone {
  if (status === 'urgent') {
    return 'danger';
  }
  if (status === 'warning') {
    return 'warning';
  }
  return 'safe';
}

function withAlpha(hex: string, alpha: number) {
  if (!hex.startsWith('#')) {
    return hex;
  }
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return hex;
  }
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function BottomCTA({
  label,
  onPress,
  disabled = false,
  status = 'relaxed',
  tone,
  style,
}: BottomCTAProps) {
  const appearance = getStatusAppearance(status);
  const isUrgent = status === 'urgent';
  const isRelaxed = status === 'relaxed';
  const resolvedTone = tone ?? mapStatusToTone(status);
  const toneColor = uiTheme.status[resolvedTone];
  const backgroundColor = disabled
    ? theme.colors.background.elevated
    : tone
      ? toneColor
      : isRelaxed
        ? theme.colors.accent.relaxed
        : appearance.color;
  const shadowColor = withAlpha(backgroundColor, 0.5);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.baseShadow,
        {
          backgroundColor,
          borderColor: disabled ? theme.colors.border.subtle : appearance.subtleBorder,
          shadowColor,
          opacity: pressed ? 0.92 : isRelaxed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          elevation: isUrgent ? 14 : 12,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text.inverse }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: theme.border.thin,
    borderRadius: 40,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    alignSelf: 'stretch',
  },
  baseShadow: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 13,
  },
  label: {
    ...theme.typography.body.strong,
  },
});
