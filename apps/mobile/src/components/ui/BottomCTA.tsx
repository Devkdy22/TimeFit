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

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isUrgent ? theme.elevation.lg : theme.elevation.md,
        {
          backgroundColor: disabled
            ? theme.colors.background.elevated
            : tone
              ? toneColor
              : isRelaxed
                ? theme.colors.accent.relaxed
                : appearance.color,
          borderColor: disabled ? theme.colors.border.subtle : appearance.subtleBorder,
          opacity: pressed ? 0.92 : isRelaxed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
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
    borderRadius: theme.radius.xl,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    alignSelf: 'stretch',
  },
  label: {
    ...theme.typography.body.strong,
  },
});
