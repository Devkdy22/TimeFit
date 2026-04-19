import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { resolveKakaoAddressFromCoord, type KakaoAddressResult } from '../services/kakaoGeoService';

export const ACCURACY_THRESHOLD = 80; // 수집 기준 정확도 (m)
export const READINGS_REQUIRED = 3; // 평균 계산에 필요한 최소 측위 횟수
export const TIMEOUT_MS = 15000; // 측위 타임아웃

const WEB_ACCURACY_THRESHOLD = 120;

export interface LocationReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  readings: LocationReading[];
  roadAddress: string | null;
  jibunAddress: string | null;
  displayAddress: string;
}

interface UseCurrentLocationState {
  location: LocationResult | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

function getAccuracyThresholdByPlatform() {
  return Platform.OS === 'web' ? WEB_ACCURACY_THRESHOLD : ACCURACY_THRESHOLD;
}

function toFriendlyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('permission')) {
      return '위치 권한이 필요합니다. 설정에서 허용해주세요.';
    }
    if (error.message.includes('timeout')) {
      return '위치 측위 시간이 초과되었습니다.';
    }
    return error.message;
  }

  return '위치 신호를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.';
}

function sortByBestAccuracy(readings: LocationReading[]) {
  return [...readings].sort((a, b) => a.accuracy - b.accuracy);
}

function averageBestReadings(readings: LocationReading[]) {
  const sorted = sortByBestAccuracy(readings);
  const best = sorted.slice(0, Math.min(READINGS_REQUIRED, sorted.length));

  const latitude = best.reduce((sum, r) => sum + r.latitude, 0) / best.length;
  const longitude = best.reduce((sum, r) => sum + r.longitude, 0) / best.length;
  const accuracy = best.reduce((sum, r) => sum + r.accuracy, 0) / best.length;

  return {
    latitude,
    longitude,
    accuracy,
    readings: best,
  };
}

export function useCurrentLocation() {
  const [state, setState] = useState<UseCurrentLocationState>({
    location: null,
    loading: false,
    error: null,
    permissionGranted: false,
  });

  // watch subscription은 반드시 useRef로 관리해 클로저/중복 구독 문제를 방지한다.
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readingsRef = useRef<LocationReading[]>([]);
  const inFlightRef = useRef(false);

  // 공통 정리 함수: 구독/타이머를 반드시 제거해 메모리 누수를 막는다.
  const clearTrackingResources = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, []);

  // 권한 상태 조회
  const refreshPermission = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    const granted = permission.granted;
    setState((prev) => ({ ...prev, permissionGranted: granted }));
    return granted;
  }, []);

  // 권한 요청 + 거부 시 설정 화면 유도
  const ensurePermission = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      setState((prev) => ({ ...prev, permissionGranted: true }));
      return true;
    }

    const requested = await Location.requestForegroundPermissionsAsync();
    const granted = requested.granted;
    setState((prev) => ({ ...prev, permissionGranted: granted }));

    if (!granted) {
      if (Platform.OS === 'web') {
        Alert.alert(
          '위치 권한 필요',
          '브라우저 주소창의 위치 권한을 허용한 뒤 다시 시도해주세요. (HTTPS 환경 필요)',
        );
      } else {
        Alert.alert(
          '위치 권한 필요',
          '위치 권한이 필요합니다. 설정에서 허용해주세요.',
          [
            {
              text: '설정으로 이동',
              onPress: () => {
                void Linking.openSettings();
              },
            },
            {
              text: '취소',
              style: 'cancel',
            },
          ],
        );
      }
    }

    return granted;
  }, []);

  // 측위 완료 시 주소 변환 + 최종 state 저장
  const commitLocationResult = useCallback(
    async (
      averaged: {
        latitude: number;
        longitude: number;
        accuracy: number;
        readings: LocationReading[];
      },
      addressOverride?: KakaoAddressResult,
    ) => {
      try {
        const addressResult =
          addressOverride ??
          (await resolveKakaoAddressFromCoord(averaged.latitude, averaged.longitude));

        const finalResult: LocationResult = {
          latitude: averaged.latitude,
          longitude: averaged.longitude,
          accuracy: averaged.accuracy,
          readings: averaged.readings,
          roadAddress: addressResult.roadAddress,
          jibunAddress: addressResult.jibunAddress,
          displayAddress: addressResult.displayAddress,
        };

        console.info('[Location]', '측위 완료 정확도(m)', {
          accuracy: Number(finalResult.accuracy.toFixed(2)),
          lat: finalResult.latitude,
          lng: finalResult.longitude,
          address: finalResult.displayAddress,
        });

        setState((prev) => ({
          ...prev,
          location: finalResult,
          loading: false,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: toFriendlyErrorMessage(error),
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  // 타임아웃 처리: 수집값이 있으면 가장 좋은 값으로 fallback
  const handleTimeout = useCallback(async () => {
    clearTrackingResources();

    const collected = readingsRef.current;
    if (collected.length === 0) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: '위치 측위 시간이 초과되었습니다.',
      }));
      inFlightRef.current = false;
      return;
    }

    const averaged = averageBestReadings(collected);
    await commitLocationResult(averaged);
  }, [clearTrackingResources, commitLocationResult]);

  // 내 위치 재실행 핵심 로직
  const requestCurrentLocation = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    const granted = await ensurePermission();
    if (!granted) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: '위치 권한이 필요합니다. 설정에서 허용해주세요.',
      }));
      return;
    }

    inFlightRef.current = true;
    clearTrackingResources();
    readingsRef.current = [];

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      // 최고 정밀도 기반 watch 측위 시작
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (position) => {
          const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
          const threshold = getAccuracyThresholdByPlatform();

          // 정확도 기준 이하 샘플만 수집
          if (accuracy > threshold) {
            return;
          }

          readingsRef.current.push({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy,
            timestamp: Date.now(),
          });

          if (readingsRef.current.length >= READINGS_REQUIRED) {
            const averaged = averageBestReadings(readingsRef.current);
            clearTrackingResources();
            void commitLocationResult(averaged);
          }
        },
      );

      subscriptionRef.current = subscription;

      // 실내 환경 대응 15초 타임아웃
      timeoutRef.current = setTimeout(() => {
        void handleTimeout();
      }, TIMEOUT_MS);
    } catch (error) {
      clearTrackingResources();
      inFlightRef.current = false;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: toFriendlyErrorMessage(error),
      }));
    }
  }, [clearTrackingResources, commitLocationResult, ensurePermission, handleTimeout]);

  // 앱 복귀 시 권한 상태 재체크
  useEffect(() => {
    void refreshPermission();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermission();
      }
    });

    return () => {
      sub.remove();
    };
  }, [refreshPermission]);

  // 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      clearTrackingResources();
      inFlightRef.current = false;
    };
  }, [clearTrackingResources]);

  return {
    location: state.location,
    loading: state.loading,
    error: state.error,
    permissionGranted: state.permissionGranted,
    requestCurrentLocation,
    retry: requestCurrentLocation,
    refreshPermission,
    locationAccuracyHint:
      '정확도 향상을 위해 기기 설정 > 위치 > Google 위치 정확도(와이파이/블루투스 스캔) 활성화를 권장합니다.',
  };
}
