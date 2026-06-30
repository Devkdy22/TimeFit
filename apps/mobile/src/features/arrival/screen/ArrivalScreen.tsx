import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreen, Header, InfoCard, PrimaryButton, SecondaryButton, TimeyMascot } from '../../../components/app';
import { useAuth } from '../../auth/context';
import type { ArrivalSummary } from '../model/types';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useNavigationHelper } from '../../../utils/navigation';
import { TIMEY_FEATURES } from '../../../config/features';

const mockArrivalSummary: ArrivalSummary = {
  originName: '집',
  destinationName: '회사',
  departureTime: '08:12',
  arrivalTime: '09:25',
  durationText: '1시간 13분',
  status: 'onTime',
  statusLabel: '예정시간 도착',
  bufferMinutes: 4,
};

export function ArrivalScreen() {
  const nav = useNavigationHelper();
  const { isLoggedIn, setPendingRoutineSeed } = useAuth();
  const arrivalSummary = TIMEY_FEATURES.enableDemoMocks ? mockArrivalSummary : null;

  const onPressSaveRoutine = () => {
    if (!arrivalSummary) {
      return;
    }
    setPendingRoutineSeed({
      originName: arrivalSummary.originName,
      destinationName: arrivalSummary.destinationName,
      targetTime: arrivalSummary.arrivalTime,
    });

    if (isLoggedIn) {
      nav.goToRoutineCreate();
      return;
    }

    nav.goToLogin();
  };

  return (
    <AppScreen scrollable contentContainerStyle={styles.container}>
      <Header title="도착 완료" onPressBack={nav.goBack} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="checkmark" size={34} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>도착 완료!</Text>
        <Text style={styles.heroSubtitle}>예정 시간에 맞춰 도착했어요.</Text>
        <TimeyMascot size={92} expression="smile" />
      </View>

      {arrivalSummary ? (
        <InfoCard>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.cardTitle}>이동 요약</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{arrivalSummary.statusLabel}</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <Text style={styles.key}>출발 시간</Text>
              <Text style={styles.value}>{arrivalSummary.departureTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.key}>도착 시간</Text>
              <Text style={styles.value}>{arrivalSummary.arrivalTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.key}>총 소요 시간</Text>
              <Text style={styles.value}>{arrivalSummary.durationText}</Text>
            </View>
          </View>

          <Text style={styles.route}>{arrivalSummary.originName} {'->'} {arrivalSummary.destinationName}</Text>
          <View style={styles.routeLine}>
            <View style={styles.routeProgress} />
          </View>
        </InfoCard>
      ) : (
        <InfoCard>
          <Text style={styles.cardTitle}>이동 요약 없음</Text>
          <Text style={styles.emptySummaryText}>완료된 실제 이동 기록이 있을 때 요약이 표시됩니다.</Text>
        </InfoCard>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="다음 이동 계획하기" onPress={nav.goToSearch} />
        {arrivalSummary ? (
          <SecondaryButton label="이 경로를 루틴으로 저장" onPress={onPressSaveRoutine} />
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  hero: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: appColors.textPrimary,
    ...appTypography.screenTitle,
  },
  heroSubtitle: {
    color: appColors.textSecondary,
    ...appTypography.body,
  },
  cardTitle: {
    color: appColors.textPrimary,
    ...appTypography.cardTitle,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: appColors.primaryLight,
  },
  badgeText: {
    color: appColors.primaryDark,
    ...appTypography.small,
  },
  summaryGrid: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  key: {
    color: appColors.textSecondary,
    ...appTypography.caption,
  },
  value: {
    color: appColors.textPrimary,
    textAlign: 'right',
    ...appTypography.body,
  },
  route: {
    marginTop: 14,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  emptySummaryText: {
    marginTop: 8,
    color: appColors.textSecondary,
    ...appTypography.body,
  },
  routeLine: {
    height: 4,
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: '#E9F4F3',
  },
  routeProgress: {
    width: '82%',
    height: 4,
    borderRadius: 999,
    backgroundColor: appColors.primary,
  },
  actions: {
    gap: 10,
    paddingBottom: 8,
  },
});
