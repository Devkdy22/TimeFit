import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { HomeTabBar } from '../../../components/home';
import { useNavigationHelper } from '../../../utils/navigation';
import { useCommutePlan } from '../../commute-state/context';
import { useCurrentLocation } from '../location/useCurrentLocation';
import { useAuth } from '../../auth/context';
import { useRoutines } from '../../routine/context';
import { HomeHero } from '../components/HomeHero';
import { DepartureCalculatorCard } from '../components/DepartureCalculatorCard';
import { LoginBenefitCard } from '../components/LoginBenefitCard';
import { GuestNoticeCard } from '../components/GuestNoticeCard';
import { RoutineSection } from '../components/RoutineSection';
import { colors, layout, spacing } from '../constants/homeTheme';
import { selectTimeyContextFromHome } from '../../../domain/timey/timeySelectors';
import { resolveTimeyStateMachine } from '../../../domain/timey/timeyStateMachine';
import type { Routine as HomeRoutine } from '../types/home.types';
import type { Routine } from '../../routine/model/types';

function toClockText(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function toCoordinateText(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function HomeContainer() {
  const nav = useNavigationHelper();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, profile } = useAuth();
  const { routines } = useRoutines();
  const { resolveOnce } = useCurrentLocation();
  const { origin, arrivalAt, destination, setArrivalAt, applyPlaceToField, clearPlaceField, setSelectedRoute } = useCommutePlan();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [resolvingCurrentLocation, setResolvingCurrentLocation] = useState(false);

  const selectedArrivalTime = arrivalAt ?? toClockText(new Date());
  const selectedDestinationName = destination?.name;

  const isGuest = !isLoggedIn;
  const activeRoutines = useMemo(() => routines.filter((routine) => routine.active), [routines]);
  const routinePreview = useMemo(() => activeRoutines.slice(0, 3).map(toHomeRoutine), [activeRoutines]);
  const hasSavedRoutine = activeRoutines.length > 0;
  const isSearching = !origin || !destination;
  const hasRouteSelected = Boolean(origin && destination && arrivalAt);
  const homeTimeyState = resolveTimeyStateMachine(
    selectTimeyContextFromHome({
      isGuest,
      hasRouteSelected,
      isSearching,
      hasSavedRoutine,
      isFirstVisit: false,
    }),
  );

  const openSearchWithOriginChoice = () => {
    if (resolvingCurrentLocation) {
      return;
    }

    const goSearchWithoutLocation = () => {
      clearPlaceField('origin');
      nav.goToSearch();
    };

    const applyCurrentLocationAndNavigate = async () => {
      try {
        setResolvingCurrentLocation(true);
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission = existingPermission.granted ? existingPermission : await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('권한 필요', '현재 위치를 사용하려면 위치 권한을 허용해 주세요.');
          return;
        }

        const resolved = await resolveOnce({ forceFresh: true });
        const finalAddress =
          resolved.locationInfo.roadAddress?.trim() ||
          resolved.locationInfo.jibunAddress?.trim() ||
          toCoordinateText(resolved.pinPosition.lat, resolved.pinPosition.lng);

        applyPlaceToField('origin', {
          id: `current-location-${Date.now()}`,
          name: finalAddress,
          address: finalAddress,
          latitude: resolved.pinPosition.lat,
          longitude: resolved.pinPosition.lng,
          accuracy: resolved.accuracy ?? undefined,
          iconType: 'location',
        });

        nav.goToSearch();
      } catch {
        Alert.alert('위치 확인 실패', 'GPS 위치를 가져오지 못했습니다. 네트워크/권한 상태를 확인 후 다시 시도해 주세요.');
      } finally {
        setResolvingCurrentLocation(false);
      }
    };

    if (Platform.OS === 'web') {
      const shouldUseLocation = typeof window !== 'undefined' ? window.confirm('현재 위치를 출발지로 자동 설정할까요?') : false;
      if (!shouldUseLocation) {
        goSearchWithoutLocation();
        return;
      }
      void applyCurrentLocationAndNavigate();
      return;
    }

    Alert.alert('출발지 설정', '현재 위치를 출발지로 자동 설정할까요?', [
      { text: '허용 안 함', style: 'cancel', onPress: goSearchWithoutLocation },
      { text: '허용', onPress: () => void applyCurrentLocationAndNavigate() },
    ]);
  };

  const handleCalculate = () => {
    if (!selectedDestinationName) {
      Alert.alert('안내', '목적지를 먼저 선택해주세요.');
      return;
    }
    if (!selectedArrivalTime) {
      Alert.alert('안내', '도착 시간을 설정해주세요.');
      return;
    }
    nav.goToRecommendation();
  };

  const applyRoutine = (routine: HomeRoutine) => {
    const source = activeRoutines.find((item) => item.id === routine.id);
    if (!source) {
      return;
    }
    applyPlaceToField('origin', {
      id: `routine-origin-${source.id}`,
      name: source.originName,
      address: source.originName,
      latitude: source.originLat,
      longitude: source.originLng,
      iconType: 'location',
    });
    applyPlaceToField('destination', {
      id: `routine-destination-${source.id}`,
      name: source.destinationName,
      address: source.destinationName,
      latitude: source.destinationLat,
      longitude: source.destinationLng,
      iconType: 'location',
    });
    setArrivalAt(source.targetTime);
    setSelectedRoute(null);
    nav.goToRecommendation();
  };

  const contentBottom = useMemo(() => layout.tabBarHeight + insets.bottom + 36, [insets.bottom]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <LinearGradient colors={[colors.backgroundTop, colors.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]} showsVerticalScrollIndicator={false}>
          <HomeHero userName={isGuest ? undefined : profile?.name ?? undefined} timeyState={homeTimeyState} />

          <DepartureCalculatorCard
            arrivalTime={selectedArrivalTime}
            destinationLabel={selectedDestinationName ?? '목적지를 검색하세요'}
            pickerVisible={pickerVisible}
            onOpenTimePicker={() => setPickerVisible(true)}
            onCloseTimePicker={() => setPickerVisible(false)}
            onConfirmTime={(time) => {
              setArrivalAt(time);
              setPickerVisible(false);
            }}
            onPressDestination={openSearchWithOriginChoice}
            onPressCalculate={handleCalculate}
          />

          {isGuest ? (
            <>
              <LoginBenefitCard onPressLogin={nav.goToLogin} />
              <GuestNoticeCard />
            </>
          ) : null}

          {!isGuest ? (
            <RoutineSection
              routines={routinePreview}
              onPressAll={nav.goToRoutines}
              onPressRoutine={applyRoutine}
              onPressAddRoutine={nav.goToRoutines}
              onPressSearchOnly={nav.goToSearch}
            />
          ) : null}
        </ScrollView>

        <HomeTabBar status="relaxed" />
      </View>
    </SafeAreaView>
  );
}

function toHomeRoutine(routine: Routine): HomeRoutine {
  return {
    id: routine.id,
    name: routine.name,
    originName: routine.originName,
    destinationName: routine.destinationName,
    departureTime: estimateDepartureTime(routine.targetTime),
    arrivalTime: routine.targetTime,
    daysLabel: toDaysLabel(routine.repeatDays),
    transitSummary: '저장된 루틴',
    bufferMinutes: 10,
  };
}

function estimateDepartureTime(arrivalTime: string) {
  const [hourRaw, minuteRaw] = arrivalTime.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return arrivalTime;
  }
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() - 45);
  return toClockText(date);
}

function toDaysLabel(days: Routine['repeatDays']) {
  if (days.length === 0) {
    return '요일 미설정';
  }
  const labels: Record<Routine['repeatDays'][number], string> = {
    sun: '일',
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
  };
  return days.map((day) => labels[day]).join('·');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xxl,
  },
});
