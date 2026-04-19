import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LocationButton } from './LocationButton';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { MapWeb } from './maps/MapWeb';
import { KakaoMapCrossPlatform } from '../features/map/components/KakaoMapCrossPlatform';
import type { MapCenterSource } from '../features/map/webview/types';

type CenterState = {
  lat: number;
  lng: number;
  address: string;
  source: MapCenterSource;
};

const DEFAULT_CENTER: CenterState = {
  lat: 37.5665,
  lng: 126.978,
  address: '서울 시청',
  source: 'init',
};

export function MapScreen() {
  const {
    location,
    loading,
    error,
    requestCurrentLocation,
    retry,
    locationAccuracyHint,
  } = useCurrentLocation();

  const [center, setCenter] = useState<CenterState>(DEFAULT_CENTER);

  const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

  // 측위 결과가 들어오면 지도 중심/마커를 최종 평균 좌표로 업데이트한다.
  useEffect(() => {
    if (!location) {
      return;
    }

    setCenter({
      lat: location.latitude,
      lng: location.longitude,
      address: location.displayAddress,
      source: 'gps',
    });
  }, [location]);

  // 디버깅용 정확도 출력
  useEffect(() => {
    if (!location) {
      return;
    }
    console.info('[MapScreen]', 'current location accuracy(m)', location.accuracy);
  }, [location]);

  const mapMarker = useMemo(
    () => ({ lat: center.lat, lng: center.lng }),
    [center.lat, center.lng],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>카카오맵 현재 위치</Text>

      {Platform.OS === 'web' ? (
        <MapWeb jsApiKey={kakaoJsKey} center={mapMarker} marker={mapMarker} />
      ) : (
        <View style={styles.nativeMapWrap}>
          <KakaoMapCrossPlatform
            jsApiKey={kakaoJsKey}
            center={center}
            onCenterChange={(next) => {
              // 사용자 드래그 시에는 지도만 이동하고, GPS 원본 좌표는 유지한다.
              setCenter((prev) => ({
                ...prev,
                lat: next.lat,
                lng: next.lng,
                address: next.address ?? prev.address,
                source: next.source,
              }));
            }}
            style={styles.nativeMap}
          />
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.label}>주소</Text>
        <Text style={styles.value}>{location?.displayAddress ?? center.address}</Text>
        <Text style={styles.meta}>
          좌표: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </Text>
        <Text style={styles.meta}>정확도: {location ? `${location.accuracy.toFixed(1)}m` : '미측정'}</Text>
      </View>

      <LocationButton
        loading={loading}
        onPress={() => {
          void requestCurrentLocation();
        }}
        onRetry={() => {
          void retry();
        }}
        error={error}
      />

      <Text style={styles.hint}>{locationAccuracyHint}</Text>
      <Text style={styles.hint}>웹 테스트는 HTTPS 환경에서 수행하세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  nativeMapWrap: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8EEF7',
  },
  nativeMap: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  value: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    color: '#334155',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
