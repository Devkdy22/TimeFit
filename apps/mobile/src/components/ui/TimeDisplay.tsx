import { StyleSheet, Text, View } from 'react-native';
import { uiTheme } from '../../constants/theme';
import { theme } from '../../theme/theme';

export interface TimeDisplayProps {
  label: string;
  time: string;
  emphasize?: boolean;
  size?: 'normal' | 'hero';
  centered?: boolean;
}

export function TimeDisplay({
  label,
  time,
  emphasize = false,
  size = 'normal',
  centered = false,
}: TimeDisplayProps) {
  return (
    <View style={[styles.container, centered ? styles.centered : null]}>
      <Text style={[styles.label, centered ? styles.centeredText : null]}>{label}</Text>
      <Text style={[styles.time, size === 'hero' ? styles.timeHero : null, emphasize ? styles.timeEmphasis : null]}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: uiTheme.spacing.s4,
  },
  centered: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  label: {
    ...theme.typography.label,
    color: uiTheme.colors.textSecondary,
  },
  time: {
    ...theme.typography.cardTitle,
    color: uiTheme.colors.textPrimary,
  },
  timeHero: {
    ...theme.typography.display,
    fontWeight: '700',
  },
  timeEmphasis: {
    color: uiTheme.status.warning,
  },
});
