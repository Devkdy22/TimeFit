import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme/theme';
import { getStatusAppearance } from './status-styles';
import type { BaseUiProps } from './types';

export interface FloatingCardProps extends BaseUiProps {
  elevation?: 'sm' | 'md' | 'lg';
}

export function FloatingCard({
  children,
  status = 'relaxed',
  elevation = 'md',
  style,
}: FloatingCardProps) {
  const appearance = getStatusAppearance(status);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.surface,
          borderColor: appearance.subtleBorder,
        },
        theme.elevation[elevation],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
});
