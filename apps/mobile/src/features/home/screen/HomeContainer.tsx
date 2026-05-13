import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { CommuteStatus, RecentDestination } from '../../../components/home';
import { useNavigationHelper } from '../../../utils/navigation';
import { useHomeState } from '../hooks/useHomeState';
import { HomeView } from './HomeView';
import { useCommutePlan } from '../../commute-state/context';
import { useCurrentLocation } from '../location/useCurrentLocation';
import { useRecommendRoutes } from '../../../hooks/useRecommendRoutes';

function toStatusKey(status: string): CommuteStatus {
  if (status === 'urgent') {
    return 'urgent';
  }

  if (status === 'warning') {
    return 'warning';
  }

  return 'relaxed';
}

function toCoordinateText(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function toClockText(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function toArrivalIso(clock: string | null): string | null {
  if (!clock) {
    return null;
  }
  const [hourText, minuteText] = clock.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

export function HomeContainer() {
  const {
    hasOrigin,
    arrivalAt,
    hasArrivalAt,
    status,
    destinationLabel,
    hasDestination,
    recentPlaces,
    setArrivalAt,
  } = useHomeState();
  const { origin, destination: destinationPlace, applyPlaceToField, clearPlaceField } = useCommutePlan();
  const nav = useNavigationHelper();
  const { resolveOnce } = useCurrentLocation();
  const [resolvingCurrentLocation, setResolvingCurrentLocation] = useState(false);

  const arrivalTime = arrivalAt ?? '시간 설정 필요';
  const pickerTime = arrivalAt ?? toClockText(new Date());
  const destination = destinationLabel;
  const canStartImmediately = hasOrigin && hasDestination && hasArrivalAt;
  const shouldGuideToSearch = !canStartImmediately;
  const realtimeRequest = useMemo(() => {
    const arrivalIso = toArrivalIso(arrivalAt);
    if (!canStartImmediately || !origin || !destinationPlace || !arrivalIso) {
      return undefined;
    }
    return {
      origin: {
        name: origin.name,
        lat: origin.latitude,
        lng: origin.longitude,
      },
      destination: {
        name: destinationPlace.name,
        lat: destinationPlace.latitude,
        lng: destinationPlace.longitude,
      },
      arrivalAt: arrivalIso,
    };
  }, [arrivalAt, canStartImmediately, destinationPlace, origin]);
  const realtimeRecommendation = useRecommendRoutes(realtimeRequest);
  const etaLabel = !canStartImmediately
    ? '출발시간을 계산해드릴게요'
    : realtimeRequest
      ? realtimeRecommendation.isLoading
        ? '실시간 출발시간 계산 중...'
        : realtimeRecommendation.data?.primaryRoute?.departureAt
          ? `${realtimeRecommendation.data.primaryRoute.departureAt} 출발 추천`
          : '실시간 교통 반영 후 출발시간을 안내해드려요'
      : '실시간 교통 반영 후 출발시간을 안내해드려요';
  const headline =
    canStartImmediately
      ? status.key === 'relaxed'
        ? '출발 준비를 시작해볼까요?'
        : '지금 출발해야 해요!'
      : '설정 후 바로 출발할 수 있어요';
  const ctaLabel = canStartImmediately ? '출발하기' : '출발지/도착지 선택';
  const ctaTone: 'primary' | 'subtle' = shouldGuideToSearch ? 'subtle' : 'primary';

  const recentItems = useMemo<RecentDestination[]>(() => {
    return recentPlaces.slice(0, 5).map((place, index) => ({
      id: place.id,
      name: place.name,
      subtitle: '자주가는 곳',
      time: index % 2 === 0 ? '09:00' : '18:30',
    }));
  }, [recentPlaces]);

  const applyCurrentLocationAndNavigate = async () => {
    if (resolvingCurrentLocation) {
      return;
    }

    try {
      setResolvingCurrentLocation(true);

      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission = existingPermission.granted
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('권한 필요', '현재 위치를 사용하려면 위치 권한을 허용해 주세요.');
        return;
      }

      const resolved = await resolveOnce({ forceFresh: true });
      const finalAddress =
        resolved.locationInfo.roadAddress?.trim() ||
        resolved.locationInfo.jibunAddress?.trim() ||
        toCoordinateText(resolved.pinPosition.lat, resolved.pinPosition.lng);
      const finalName = finalAddress;

      applyPlaceToField('origin', {
        id: `current-location-resolved-${Date.now()}`,
        name: finalName,
        address: finalAddress,
        latitude: resolved.pinPosition.lat,
        longitude: resolved.pinPosition.lng,
        accuracy: resolved.accuracy ?? undefined,
        iconType: 'location',
      });

      console.info('[Location]', 'apply current location once', {
        finalName,
        resolvedBy: resolved.resolvedBy,
        accuracy: resolved.accuracy,
        lat: resolved.pinPosition.lat,
        lng: resolved.pinPosition.lng,
      });

      nav.goToSearch();
    } catch {
      Alert.alert('위치 확인 실패', 'GPS 위치를 가져오지 못했습니다. 네트워크/권한 상태를 확인 후 다시 시도해 주세요.');
    } finally {
      setResolvingCurrentLocation(false);
    }
  };

  const openSearchWithOriginChoice = () => {
    if (resolvingCurrentLocation) {
      return;
    }

    if (Platform.OS === 'web') {
      const shouldUseLocation =
        typeof window !== 'undefined'
          ? window.confirm('현재 위치를 출발지로 자동 설정할까요?')
          : false;

      if (!shouldUseLocation) {
        clearPlaceField('origin');
        nav.goToSearch();
        return;
      }

      void applyCurrentLocationAndNavigate();
      return;
    }

    Alert.alert('출발지 설정', '현재 위치를 출발지로 자동 설정할까요?', [
      {
        text: '허용 안 함',
        style: 'cancel',
        onPress: () => {
          clearPlaceField('origin');
          nav.goToSearch();
        },
      },
      {
        text: '허용',
        onPress: () => {
          void applyCurrentLocationAndNavigate();
        },
      },
    ]);
  };

  const handleMainCtaPress = () => {
    if (shouldGuideToSearch) {
      openSearchWithOriginChoice();
      return;
    }
    nav.goToRecommendation();
  };

  return (
    <HomeView
      userName="홍길동"
      status={toStatusKey(status.key)}
      statusLabel={status.label}
      arrivalTime={arrivalTime}
      pickerTime={pickerTime}
      destination={destination}
      headline={headline}
      etaLabel={etaLabel}
      ctaLabel={ctaLabel}
      ctaTone={ctaTone}
      recentItems={recentItems}
      onPressStart={handleMainCtaPress}
      onPressNewRoute={openSearchWithOriginChoice}
      onChangeArrivalTime={(nextTime) => setArrivalAt(nextTime)}
      onPressDestination={openSearchWithOriginChoice}
    />
  );
}
