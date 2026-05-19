import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SocialProvider } from '../../features/auth/context';
import { appColors, appSpacing, appTypography } from '../../theme/app-tokens';

interface SocialLoginButtonProps {
  provider: SocialProvider;
  label: string;
  loading?: boolean;
  onPress: () => void;
}

const providerStyles: Record<SocialProvider, { backgroundColor: string; borderColor: string; color: string; badge: string }> = {
  google: { backgroundColor: '#FFFFFF', borderColor: appColors.border, color: appColors.textPrimary, badge: 'G' },
  kakao: { backgroundColor: '#FEE500', borderColor: '#F0D400', color: '#191919', badge: 'K' },
  naver: { backgroundColor: '#03C75A', borderColor: '#03B453', color: '#FFFFFF', badge: 'N' },
};

export function SocialLoginButton({ provider, label, loading = false, onPress }: SocialLoginButtonProps) {
  const visual = providerStyles[provider];

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.button, { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.logoWrap}>
        <Text style={[styles.logo, { color: visual.color }]}>{visual.badge}</Text>
      </View>
      <Text style={[styles.label, { color: visual.color }]}>{label}</Text>
      {loading ? <ActivityIndicator size="small" color={visual.color} /> : <View style={styles.placeholder} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  logoWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    ...appTypography.caption,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    ...appTypography.body,
  },
  placeholder: {
    width: 20,
    height: 20,
  },
});
