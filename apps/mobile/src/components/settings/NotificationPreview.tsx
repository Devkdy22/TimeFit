import { StyleSheet, Text, View } from 'react-native';
import { TimeyMascot } from '../app';
import { settingsTokens } from '../../screens/settings/tokens';

interface NotificationPreviewProps {
  title: string;
  message: string;
}

export function NotificationPreview({ title, message }: NotificationPreviewProps) {
  return (
    <View style={styles.card}>
      <TimeyMascot size={36} expression="smile" />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: settingsTokens.radius.lg,
    borderWidth: 1,
    borderColor: settingsTokens.colors.border,
    backgroundColor: '#F9FCFC',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  message: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
});
