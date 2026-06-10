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
import { colors, layout, spacing } from '../constants/homeTheme';
import { selectTimeyContextFromHome } from '../../../domain/timey/timeySelectors';
import { resolveTimeyStateMachine } from '../../../domain/timey/timeyStateMachine';

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
  const { isLoggedIn } = useAuth();
  const { routines } = useRoutines();
  const { resolveOnce } = useCurrentLocation();
  const { origin, arrivalAt, destination, setArrivalAt, applyPlaceToField, clearPlaceField } = useCommutePlan();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [resolvingCurrentLocation, setResolvingCurrentLocation] = useState(false);

  const selectedArrivalTime = arrivalAt ?? toClockText(new Date());
  const selectedDestinationName = destination?.name;

  const isGuest = !isLoggedIn;
  const hasSavedRoutine = routines.length > 0;
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

  const contentBottom = useMemo(() => layout.tabBarHeight + insets.bottom + 36, [insets.bottom]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <LinearGradient colors={[colors.backgroundTop, colors.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]} showsVerticalScrollIndicator={false}>
          <HomeHero userName={isGuest ? undefined : '홍길동'} timeyState={homeTimeyState} />

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
        </ScrollView>

        <HomeTabBar status="relaxed" />
      </View>
    </SafeAreaView>
  );
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
