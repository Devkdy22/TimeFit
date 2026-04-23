import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LocationReading, LocationResult } from '../types/location';
import {
  ACCURACY_THRESHOLD,
  READINGS_REQUIRED,
  TIMEOUT_MS,
  calculateAverageLocation,
  filterReadingsByAccuracy,
  pickTopNByAccuracy,
} from '../utils/locationUtils';
import { resolveKakaoAddressFromCoord } from '../services/kakaoGeoService';

interface UseCurrentLocationState {
  location: LocationResult | null;
  isLoading: boolean;
  error: string | null;
  accuracy: number | null;
}

function mapGeolocationErrorCode(code?: number): string {
  if (code === 1) {
    return '위치 권한이 필요합니다. 설정에서 허용해주세요.';
  }
  if (code === 2) {
    return '위치 신호를 찾을 수 없습니다.';
  }
  if (code === 3) {
    return '위치 측위 시간이 초과되었습니다.';
  }
  return '위치 신호를 찾을 수 없습니다.';
}

function isSecureWebContext(): boolean {
  if (Platform.OS !== 'web') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function useCurrentLocation(): {
  location: LocationResult | null;
  isLoading: boolean;
  error: string | null;
  accuracy: number | null;
  getCurrentLocation: () => Promise<void>;
} {
  const [state, setState] = useState<UseCurrentLocationState>({
    location: null,
    isLoading: false,
    error: null,
    accuracy: null,
  });

  // Android expo-location watch subscription
  const androidSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  // Web navigator.geolocation watchId
  const webWatchIdRef = useRef<number | null>(null);
  // 공통 타임아웃
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 수집 샘플 버퍼
  const readingsRef = useRef<LocationReading[]>([]);
  // 중복 실행 방지
  const inFlightRef = useRef<boolean>(false);
  // 콜백 레이스 방지용 요청 id
  const requestIdRef = useRef<number>(0);

  const clearTrackingResources = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (androidSubscriptionRef.current) {
      androidSubscriptionRef.current.remove();
      androidSubscriptionRef.current = null;
    }

    if (Platform.OS === 'web' && webWatchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
  }, []);

  const finalizeWithReadings = useCallback(
    async (requestId: number, allowPartial: boolean): Promise<void> => {
      if (requestId !== requestIdRef.current) {
        return;
      }

      clearTrackingResources();

      const filtered = filterReadingsByAccuracy(readingsRef.current, ACCURACY_THRESHOLD);
      const selected = pickTopNByAccuracy(filtered, READINGS_REQUIRED);

      if (!selected.length || (!allowPartial && selected.length < READINGS_REQUIRED)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '위치 측위 시간이 초과되었습니다.',
        }));
        inFlightRef.current = false;
        return;
      }

      try {
        const averaged = calculateAverageLocation(selected);
        const address = await resolveKakaoAddressFromCoord(averaged.latitude, averaged.longitude);

        if (requestId !== requestIdRef.current) {
          return;
        }

        const result: LocationResult = {
          latitude: averaged.latitude,
          longitude: averaged.longitude,
          accuracy: averaged.accuracy,
          address: address.address,
          roadAddress: address.roadAddress,
          jibunAddress: address.jibunAddress,
        };

        console.info('[useCurrentLocation] 측위 완료 정확도(m):', Number(result.accuracy.toFixed(1)));

        setState({
          location: result,
          isLoading: false,
          error: null,
          accuracy: result.accuracy,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '위치 신호를 찾을 수 없습니다.';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [clearTrackingResources],
  );

  const startAndroidWatch = useCallback(
    async (requestId: number): Promise<void> => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '위치 권한이 필요합니다. 설정에서 허용해주세요.',
        }));

        inFlightRef.current = false;

        try {
          await Linking.openSettings();
        } catch {
          // 설정 열기 실패 시 에러 메시지로 안내한다.
        }

        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (position: Location.LocationObject) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
          if (accuracy > ACCURACY_THRESHOLD) {
            return;
          }

          readingsRef.current.push({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy,
            timestamp: Date.now(),
          });

          if (readingsRef.current.length >= READINGS_REQUIRED) {
            void finalizeWithReadings(requestId, false);
          }
        },
      );

      androidSubscriptionRef.current = subscription;

      timeoutRef.current = setTimeout(() => {
        void finalizeWithReadings(requestId, true);
      }, TIMEOUT_MS);
    },
    [finalizeWithReadings],
  );

  const startWebWatch = useCallback(
    async (requestId: number): Promise<void> => {
      if (!isSecureWebContext()) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '위치 서비스는 HTTPS 환경에서만 사용 가능합니다.',
        }));
        inFlightRef.current = false;
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '위치 신호를 찾을 수 없습니다.',
        }));
        inFlightRef.current = false;
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (position: GeolocationPosition) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
          if (accuracy > ACCURACY_THRESHOLD) {
            return;
          }

          readingsRef.current.push({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy,
            timestamp: Date.now(),
          });

          if (readingsRef.current.length >= READINGS_REQUIRED) {
            void finalizeWithReadings(requestId, false);
          }
        },
        (error: GeolocationPositionError) => {
          if (requestId !== requestIdRef.current) {
            return;
          }

          clearTrackingResources();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: mapGeolocationErrorCode(error.code),
          }));
          inFlightRef.current = false;
        },
        {
          enableHighAccuracy: true,
          timeout: TIMEOUT_MS,
          maximumAge: 0,
        },
      );

      webWatchIdRef.current = watchId;

      timeoutRef.current = setTimeout(() => {
        void finalizeWithReadings(requestId, true);
      }, TIMEOUT_MS);
    },
    [clearTrackingResources, finalizeWithReadings],
  );

  const getCurrentLocation = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    clearTrackingResources();
    readingsRef.current = [];

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      if (Platform.OS === 'web') {
        await startWebWatch(requestId);
      } else if (Platform.OS === 'android') {
        await startAndroidWatch(requestId);
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '현재 플랫폼은 위치 측위를 지원하지 않습니다.',
        }));
        inFlightRef.current = false;
      }
    } catch (error) {
      clearTrackingResources();

      const message = error instanceof Error ? error.message : '위치 신호를 찾을 수 없습니다.';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      inFlightRef.current = false;
    }
  }, [clearTrackingResources, startAndroidWatch, startWebWatch]);

  // 첫 진입 시 자동 측위 1회 실행
  useEffect(() => {
    void getCurrentLocation();
  }, [getCurrentLocation]);

  // 언마운트 시 구독/워치 정리
  useEffect(() => {
    return () => {
      clearTrackingResources();
      inFlightRef.current = false;
    };
  }, [clearTrackingResources]);

  return {
    location: state.location,
    isLoading: state.isLoading,
    error: state.error,
    accuracy: state.accuracy,
    getCurrentLocation,
  };
}
