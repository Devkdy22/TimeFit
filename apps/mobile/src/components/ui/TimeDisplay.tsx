import { StyleSheet, Text, View } from 'react-native';
import { uiTheme } from '../../constants/theme';

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
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  time: {
    ...uiTheme.typography.time,
    color: uiTheme.colors.textPrimary,
  },
  timeHero: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeEmphasis: {
    color: uiTheme.status.warning,
  },
});
