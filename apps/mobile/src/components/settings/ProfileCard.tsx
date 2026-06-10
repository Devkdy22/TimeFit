import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TimeyMascot } from '../app';
import { settingsTokens } from '../../screens/settings/tokens';

interface ProfileCardProps {
  name: string;
  email: string;
  providerLabel: string;
  isLoginRequired?: boolean;
  onPress: () => void;
  onPressLoginRequired?: () => void;
}

export function ProfileCard({
  name,
  email,
  providerLabel,
  isLoginRequired = false,
  onPress,
  onPressLoginRequired,
}: ProfileCardProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(76,199,193,0.14)' }}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={styles.left}>
        <TimeyMascot size={58} expression="smile" />
        <View style={styles.texts}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          {isLoginRequired ? (
            <Pressable
              onPress={onPressLoginRequired ?? onPress}
              android_ripple={{ color: 'rgba(76,199,193,0.22)' }}
              style={({ pressed }) => [styles.loginBadge, { opacity: pressed ? 0.84 : 1 }]}
            >
              <Ionicons name="lock-closed-outline" size={12} color="#1E8C86" />
              <Text style={styles.loginBadgeText}>{providerLabel}</Text>
              <Ionicons name="chevron-forward" size={12} color="#1E8C86" />
            </Pressable>
          ) : (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{providerLabel}</Text>
            </View>
          )}
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
  loginBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#86D7D1',
    backgroundColor: '#EAF9F7',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loginBadgeText: {
    color: '#1E8C86',
    ...settingsTokens.typography.caption,
  },
});
