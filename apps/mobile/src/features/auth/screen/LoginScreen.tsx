import { StyleSheet, Text, View } from 'react-native';
import { BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import { useNavigationHelper } from '../../../utils/navigation';

export function LoginScreen() {
  const nav = useNavigationHelper();

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="로그인" subtitle="재방문 경험을 연결하세요" status="warning" />

      <View style={styles.card}>
        <StatusBadge status="warning" label="로그인 필요" />
        <Text style={styles.title}>루틴과 이동 기록을 저장하려면 로그인하세요.</Text>
        <Text style={styles.body}>현재는 설정 화면에서 계정 연결 토글로 로그인 상태를 테스트할 수 있습니다.</Text>
      </View>

      <View style={styles.actions}>
        <BottomCTA label="설정에서 로그인" status="warning" onPress={nav.goToSettings} />
        <BottomCTA label="나중에 하기" status="relaxed" onPress={nav.goToHome} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    padding: uiTheme.spacing.s20,
    gap: uiTheme.spacing.s8,
  },
  title: {
    ...uiTheme.typography.title,
    color: uiTheme.colors.textPrimary,
  },
  body: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textSecondary,
  },
  actions: {
    gap: uiTheme.spacing.s8,
  },
});
