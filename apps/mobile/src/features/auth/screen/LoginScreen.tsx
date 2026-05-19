import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, SocialLoginButton, TimeyMascot } from '../../../components/app';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useNavigationHelper } from '../../../utils/navigation';
import { useAuth, type SocialProvider } from '../context';

export function LoginScreen() {
  const nav = useNavigationHelper();
  const { login, isLoginLoading, pendingRoutineSeed } = useAuth();

  const onPressLogin = async (provider: SocialProvider) => {
    try {
      await login(provider);
      if (pendingRoutineSeed) {
        nav.goToRoutineCreate();
        return;
      }
      nav.goToRoutines();
    } catch {
      Alert.alert('로그인 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.container}>
      <View style={styles.topSpacer} />

      <View style={styles.centerArea}>
        <TimeyMascot size={110} expression="smile" />
        <Text style={styles.title}>로그인하고 루틴을 저장해보세요</Text>
        <Text style={styles.subtitle}>자주 가는 경로와 알림을 안전하게 보관할 수 있어요.</Text>
      </View>

      <View style={styles.actions}>
        <SocialLoginButton provider="google" label="Google로 계속하기" loading={isLoginLoading} onPress={() => onPressLogin('google')} />
        <SocialLoginButton provider="kakao" label="카카오로 계속하기" loading={isLoginLoading} onPress={() => onPressLogin('kakao')} />
        <SocialLoginButton provider="naver" label="네이버로 계속하기" loading={isLoginLoading} onPress={() => onPressLogin('naver')} />

        <Text style={styles.terms}>
          계속하면 서비스 <Text style={styles.link}>이용약관</Text> 및 <Text style={styles.link}>개인정보 처리방침</Text>에 동의하게 됩니다.
        </Text>

        <Pressable onPress={nav.goBack} style={styles.laterButton}>
          <Text style={styles.laterText}>나중에 할게요</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingBottom: 36,
  },
  topSpacer: { height: 16 },
  centerArea: { alignItems: 'center', gap: 10 },
  title: { textAlign: 'center', color: appColors.textPrimary, ...appTypography.screenTitle },
  subtitle: { textAlign: 'center', color: appColors.textSecondary, ...appTypography.body },
  actions: { gap: 10 },
  terms: {
    marginTop: 6,
    textAlign: 'center',
    color: appColors.textMuted,
    ...appTypography.small,
  },
  link: { color: appColors.primaryDark, textDecorationLine: 'underline' },
  laterButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  laterText: { color: appColors.textSecondary, ...appTypography.body },
});
