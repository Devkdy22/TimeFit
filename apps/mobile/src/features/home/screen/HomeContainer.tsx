import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { CommuteStatus, RecentDestination } from '../../../components/home';
import { useNavigationHelper } from '../../../utils/navigation';
import { useHomeState } from '../hooks/useHomeState';
import { HomeView } from './HomeView';
import { useCommutePlan } from '../../commute-state/context';
import { useCurrentLocation } from '../location/useCurrentLocation';

function parseClockToFutureMinutes(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 37;
  }

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const rawMinutes = Math.round((target.getTime() - now.getTime()) / 60000);
  return Math.max(0, rawMinutes);
}

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

export function HomeContainer() {
  const { arrivalAt, status, destinationLabel, hasDestination, recentPlaces, setArrivalAt } = useHomeState();
  const { applyPlaceToField, clearPlaceField } = useCommutePlan();
  const nav = useNavigationHelper();
  const { resolveOnce } = useCurrentLocation();
  const [resolvingCurrentLocation, setResolvingCurrentLocation] = useState(false);

  const arrivalTime = arrivalAt ?? '18:48';
  const destination = hasDestination ? destinationLabel : '도착지를 선택해 주세요';
  const minutesUntilArrival = parseClockToFutureMinutes(arrivalTime);
  const etaLabel = `${Math.max(0, minutesUntilArrival - 45)}분 후 도착 예정`;
  const headline = status.key === 'relaxed' ? '출발 준비를 시작해볼까요?' : '지금 출발해야 해요!';

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

      const resolved = await resolveOnce();
      const finalAddress =
        resolved.locationInfo.jibunAddress?.trim() ||
        resolved.locationInfo.roadAddress?.trim() ||
        toCoordinateText(resolved.pinPosition.lat, resolved.pinPosition.lng);
      const finalName =
        resolved.displayName?.trim() && resolved.displayName.trim() !== '내 위치'
          ? resolved.displayName.trim()
          : finalAddress;

      applyPlaceToField('origin', {
        id: `current-location-resolved-${Date.now()}`,
        name: finalName,
        address: finalAddress,
        latitude: resolved.pinPosition.lat,
        longitude: resolved.pinPosition.lng,
        iconType: 'location',
      });

      console.info('[Location]', 'apply current location once', {
        finalName: resolved.displayName,
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

  return (
    <HomeView
      userName="홍길동"
      status={toStatusKey(status.key)}
      statusLabel={status.label}
      arrivalTime={arrivalTime}
      destination={destination}
      headline={headline}
      etaLabel={etaLabel}
      recentItems={recentItems}
      onPressStart={nav.goToTransit}
      onPressNewRoute={openSearchWithOriginChoice}
      onChangeArrivalTime={(nextTime) => setArrivalAt(nextTime)}
      onPressDestination={openSearchWithOriginChoice}
    />
  );
}
