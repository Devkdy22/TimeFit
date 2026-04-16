import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';

export interface ListItemCardProps extends Omit<BaseUiProps, 'children'> {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
  dense?: boolean;
  tone?: 'surface' | 'elevated';
}

function Content({
  title,
  subtitle,
  meta,
  dense,
  status,
}: Pick<ListItemCardProps, 'title' | 'subtitle' | 'meta' | 'dense' | 'status'>) {
  const appearance = getStatusAppearance(status ?? 'relaxed');

  return (
    <View style={[styles.content, dense ? styles.contentDense : null]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {meta ? (
        <Text style={[styles.meta, status ? { color: appearance.color } : null]}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

export function ListItemCard({
  title,
  subtitle,
  meta,
  onPress,
  dense = false,
  tone = 'surface',
  status,
  style,
}: ListItemCardProps) {
  const backgroundColor =
    tone === 'elevated' ? theme.colors.background.elevated : theme.colors.background.surface;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          dense ? styles.containerDense : null,
          { backgroundColor },
          { opacity: pressed ? 0.86 : 1 },
          style,
        ]}
      >
        <Content title={title} subtitle={subtitle} meta={meta} dense={dense} status={status} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, dense ? styles.containerDense : null, { backgroundColor }, style]}>
      <Content title={title} subtitle={subtitle} meta={meta} dense={dense} status={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 76,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center',
    ...theme.elevation.sm,
  },
  containerDense: {
    minHeight: 64,
  },
  content: {
    gap: theme.spacing.xs,
  },
  contentDense: {
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  subtitle: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
  meta: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
});
