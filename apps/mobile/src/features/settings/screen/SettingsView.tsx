import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ActionCard, BottomCTA, ScreenContainer, SectionHeader, StatusBadge } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';

export interface SettingsViewProps {
  isNotificationEnabled: boolean;
  isLiveLocationEnabled: boolean;
  isLoggedIn: boolean;
  onChangeNotification: (next: boolean) => void;
  onChangeLiveLocation: (next: boolean) => void;
  onToggleLogin: () => void;
  onPressTestMap: () => void;
  onPressOnboarding: () => void;
}

export function SettingsView({
  isNotificationEnabled,
  isLiveLocationEnabled,
  isLoggedIn,
  onChangeNotification,
  onChangeLiveLocation,
  onToggleLogin,
  onPressTestMap,
  onPressOnboarding,
}: SettingsViewProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="설정" subtitle="알림, 위치, 계정을 관리하세요" status="relaxed" />

      <ActionCard status={isNotificationEnabled ? 'warning' : 'relaxed'} title="알림" description="출발 전 행동 알림과 상태 변경 알림">
        <View style={styles.row}>
          <Text style={styles.itemLabel}>행동 알림 활성화</Text>
          <Switch value={isNotificationEnabled} onValueChange={onChangeNotification} />
        </View>
        <Text style={styles.caption}>
          {isNotificationEnabled ? '출발 10분 전부터 상태 알림 제공' : '알림이 꺼져 있어 행동 안내가 지연될 수 있음'}
        </Text>
      </ActionCard>

      <ActionCard status={isLiveLocationEnabled ? 'warning' : 'urgent'} title="위치" description="실시간 위치 기반 경로/상태 업데이트">
        <View style={styles.row}>
          <Text style={styles.itemLabel}>이동 중 위치 공유</Text>
          <Switch value={isLiveLocationEnabled} onValueChange={onChangeLiveLocation} />
        </View>
        <Text style={styles.caption}>
          {isLiveLocationEnabled ? '현재 위치 기반으로 Next Action 갱신' : '위치 비활성화 시 추천 정확도 하락'}
        </Text>
      </ActionCard>

      <ActionCard
        status={isLoggedIn ? 'relaxed' : 'warning'}
        title="계정"
        description={isLoggedIn ? 'kim@timefit.app로 로그인됨' : '로그인하면 루틴/기록을 저장할 수 있어요'}
      >
        <View style={styles.accountRow}>
          <StatusBadge status={isLoggedIn ? 'relaxed' : 'warning'} label={isLoggedIn ? '연결됨' : '미연결'} />
          <Pressable onPress={onToggleLogin} style={({ pressed }) => [styles.accountButton, { opacity: pressed ? 0.86 : 1 }]}>
            <Text style={styles.accountButtonText}>{isLoggedIn ? '로그아웃' : '로그인'}</Text>
          </Pressable>
        </View>
      </ActionCard>

      <ActionCard status="warning" title="지도 테스트" description="WebView 기반 Kakao 지도 테스트 화면 이동">
        <Pressable onPress={onPressTestMap} style={({ pressed }) => [styles.testButton, { opacity: pressed ? 0.86 : 1 }]}>
          <Text style={styles.testButtonText}>/test-map 열기</Text>
        </Pressable>
      </ActionCard>

      <BottomCTA label="온보딩 다시 보기" status="relaxed" onPress={onPressOnboarding} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: uiTheme.spacing.s12,
    justifyContent: 'space-between',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s8,
  },
  itemLabel: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
  },
  caption: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s8,
  },
  accountButton: {
    minHeight: 40,
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    paddingHorizontal: uiTheme.spacing.s12,
    justifyContent: 'center',
  },
  accountButtonText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
  },
  testButton: {
    minHeight: 44,
    borderRadius: uiTheme.radius.medium,
    backgroundColor: uiTheme.colors.primaryBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTheme.spacing.s16,
  },
  testButtonText: {
    ...uiTheme.typography.button,
    color: uiTheme.colors.card,
  },
});
