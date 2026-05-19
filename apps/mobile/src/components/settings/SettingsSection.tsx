import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { settingsTokens } from '../../screens/settings/tokens';

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SettingsSection({ title, subtitle, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  header: { gap: 4 },
  title: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  subtitle: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
  card: {
    backgroundColor: settingsTokens.colors.card,
    borderRadius: settingsTokens.radius.xl,
    borderWidth: 1,
    borderColor: settingsTokens.colors.border,
    overflow: 'hidden',
    shadowColor: '#102B2B',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
