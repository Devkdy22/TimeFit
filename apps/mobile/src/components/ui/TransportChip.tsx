import { StyleSheet, Text, View } from 'react-native';
import { uiTheme } from '../../constants/theme';

export interface TransportChipProps {
  summary: string;
}

export function TransportChip({ summary }: TransportChipProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: uiTheme.radius.large,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.s12,
  },
  text: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
  },
});
