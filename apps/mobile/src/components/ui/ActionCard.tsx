import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';

export interface ActionCardProps extends BaseUiProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  onPress?: () => void;
  footer?: ReactNode;
}

export function ActionCard({
  title,
  description,
  ctaLabel,
  onPress,
  footer,
  children,
  status = 'relaxed',
  style,
}: ActionCardProps) {
  const appearance = getStatusAppearance(status);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          theme.elevation.sm,
          {
            backgroundColor: theme.colors.background.surface,
            borderColor: appearance.subtleBorder,
            opacity: pressed ? 0.94 : 1,
          },
          style,
        ]}
      >
        <View style={[styles.statusStripe, { backgroundColor: appearance.color }]} />
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
        {ctaLabel ? <Text style={[styles.cta, { color: appearance.color }]}>{ctaLabel}</Text> : null}
        {footer}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        theme.elevation.sm,
        {
          backgroundColor: theme.colors.background.surface,
          borderColor: appearance.subtleBorder,
        },
        style,
      ]}
    >
      <View style={[styles.statusStripe, { backgroundColor: appearance.color }]} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
      {ctaLabel ? <Text style={[styles.cta, { color: appearance.color }]}>{ctaLabel}</Text> : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    overflow: 'hidden',
  },
  statusStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  title: {
    ...theme.typography.title.lg,
    color: theme.colors.text.primary,
  },
  description: {
    ...theme.typography.body.md,
    color: theme.colors.text.secondary,
  },
  cta: {
    ...theme.typography.body.strong,
    marginTop: theme.spacing.xs,
  },
});
