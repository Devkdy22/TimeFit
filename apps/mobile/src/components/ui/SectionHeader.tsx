import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';

export interface SectionHeaderProps extends Omit<BaseUiProps, 'children'> {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPressAction,
  status = 'relaxed',
  style,
}: SectionHeaderProps) {
  const appearance = getStatusAppearance(status);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textArea}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onPressAction ? (
        <Pressable onPress={onPressAction} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.actionText, { color: appearance.color }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  textArea: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.title.lg,
    color: theme.colors.text.primary,
  },
  subtitle: {
    ...theme.typography.body.md,
    color: theme.colors.text.secondary,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  actionText: {
    ...theme.typography.body.strong,
  },
});
