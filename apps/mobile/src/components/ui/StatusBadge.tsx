import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';
import { uiTheme, type StatusTone } from '../../constants/theme';

export interface StatusBadgeProps extends Omit<BaseUiProps, 'children'> {
  label?: string;
  size?: 'sm' | 'md';
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

export function StatusBadge({ status = 'relaxed', label, size = 'md', tone, style }: StatusBadgeProps) {
  const appearance = getStatusAppearance(status);
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;
  const resolvedTone = tone ?? mapStatusToTone(status);
  const color = uiTheme.status[resolvedTone];

  return (
    <View
      style={[
        styles.container,
        sizeStyle,
        {
          backgroundColor: tone ? uiTheme.colors.background : appearance.softBackground,
          borderColor: tone ? uiTheme.colors.divider : appearance.subtleBorder,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label ?? theme.status[status].label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    justifyContent: 'center',
  },
  sm: {
    minHeight: 28,
    paddingHorizontal: theme.spacing.sm,
  },
  md: {
    minHeight: 34,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
  },
});
