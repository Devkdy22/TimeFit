import { StyleSheet, Text, View } from 'react-native';
import { BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import { useNavigationHelper } from '../../../utils/navigation';

export function ArrivalScreen() {
  const nav = useNavigationHelper();

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="도착 완료" subtitle="이동이 마무리되었습니다" status="relaxed" />

      <View style={styles.content}>
        <StatusBadge status="relaxed" label="ON TIME" />
        <Text style={styles.title}>예정 시간에 도착했어요.</Text>
        <Text style={styles.body}>다음 이동을 위해 루틴과 설정을 확인해보세요.</Text>
      </View>

      <View style={styles.actions}>
        <BottomCTA label="루틴 보기" status="warning" onPress={nav.goToRoutines} />
        <BottomCTA label="홈으로" status="relaxed" onPress={nav.goToHome} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  content: {
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
