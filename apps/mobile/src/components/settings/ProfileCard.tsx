import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TimeyMascot } from '../app';
import { settingsTokens } from '../../screens/settings/tokens';

interface ProfileCardProps {
  name: string;
  email: string;
  providerLabel: string;
  onPress: () => void;
}

export function ProfileCard({ name, email, providerLabel, onPress }: ProfileCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.left}>
        <TimeyMascot size={58} expression="smile" />
        <View style={styles.texts}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{providerLabel}</Text></View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={settingsTokens.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 98,
    borderRadius: settingsTokens.radius.xl,
    borderWidth: 1,
    borderColor: settingsTokens.colors.border,
    backgroundColor: settingsTokens.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#102B2B',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  texts: { flex: 1, gap: 2 },
  name: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  email: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.body },
  badge: { alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, backgroundColor: settingsTokens.colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#1E8C86', ...settingsTokens.typography.caption },
});
