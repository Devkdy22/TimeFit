import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { LocationButton } from './LocationButton';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { KakaoMapWebView } from '../features/map/webview/KakaoMapWebView';

/*
설치 명령어
npx expo install expo-location
npx expo install react-native-web react-dom
npx expo install @expo/webpack-config
*/

type Coordinate = {
  lat: number;
  lng: number;
};

type KakaoLatLng = unknown;
type KakaoMapInstance = {
  setCenter: (latLng: KakaoLatLng) => void;
};
type KakaoMarkerInstance = {
  setMap: (map: KakaoMapInstance) => void;
  setPosition: (latLng: KakaoLatLng) => void;
};

type KakaoWindow = Window & {
  kakao?: {
    maps: {
      load: (cb: () => void) => void;
      LatLng: new (lat: number, lng: number) => KakaoLatLng;
      Map: new (
        container: HTMLElement,
        options: { center: KakaoLatLng; level: number },
      ) => KakaoMapInstance;
      Marker: new (options: { position: KakaoLatLng }) => KakaoMarkerInstance;
    };
  };
};

const DEFAULT_COORDINATE: Coordinate = {
  lat: 37.5665,
  lng: 126.978,
};

export function MapScreen() {
  const { location, isLoading, error, accuracy, getCurrentLocation } = useCurrentLocation();

  const [center, setCenter] = useState<Coordinate>(DEFAULT_COORDINATE);
  const [mapContainerId] = useState<string>(() => `kakao-web-map-${Math.random().toString(36).slice(2, 10)}`);

  const webMapRef = useRef<KakaoMapInstance | null>(null);
  const webMarkerRef = useRef<KakaoMarkerInstance | null>(null);

  const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

  useEffect(() => {
    if (!location) {
      return;
    }

    setCenter({
      lat: location.latitude,
      lng: location.longitude,
    });
  }, [location]);

  useEffect(() => {
    if (!accuracy) {
      return;
    }

    console.info('[MapScreen] current location accuracy(m):', Number(accuracy.toFixed(1)));
  }, [accuracy]);

  // 웹: Kakao JS SDK 로드 후 지도 초기화
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    if (!kakaoJsKey || typeof window === 'undefined') {
      return;
    }

    const w = window as KakaoWindow;
    const selector = `script[data-kakao-js-key="${kakaoJsKey}"]`;

    const initMap = (): void => {
      const container = document.getElementById(mapContainerId);
      if (!container || !w.kakao?.maps) {
        return;
      }

      const kakao = w.kakao;
      const centerLatLng = new kakao.maps.LatLng(center.lat, center.lng);

      const map = new kakao.maps.Map(container, {
        center: centerLatLng,
        level: 3,
      });

      const marker = new kakao.maps.Marker({
        position: centerLatLng,
      });
      marker.setMap(map);

      webMapRef.current = map;
      webMarkerRef.current = marker;
    };

    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing && w.kakao?.maps?.load) {
      w.kakao.maps.load(initMap);
      return;
    }

    const script = existing ?? document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&autoload=false`;
    script.async = true;
    script.setAttribute('data-kakao-js-key', kakaoJsKey);
    script.onload = () => {
      if (!w.kakao?.maps?.load) {
        return;
      }
      w.kakao.maps.load(initMap);
    };

    if (!existing) {
      document.head.appendChild(script);
    }
  }, [kakaoJsKey, mapContainerId]);

  // 웹: 지도 중심과 마커를 최신 좌표로 반영
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const w = window as KakaoWindow;
    if (!w.kakao?.maps || !webMapRef.current || !webMarkerRef.current) {
      return;
    }

    const next = new w.kakao.maps.LatLng(center.lat, center.lng);
    webMapRef.current.setCenter(next);
    webMarkerRef.current.setPosition(next);
  }, [center.lat, center.lng]);

  const mapAddress = useMemo(() => {
    if (!location) {
      return '현재 위치를 확인 중입니다.';
    }
    return location.address;
  }, [location]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>카카오맵 현재 위치 정확도 개선</Text>

      {Platform.OS === 'web' ? (
        kakaoJsKey ? (
          <View nativeID={mapContainerId} style={styles.mapWeb} />
        ) : (
          <View style={styles.fallbackMapBox}>
            <Text style={styles.fallbackText}>EXPO_PUBLIC_KAKAO_JS_KEY가 없어 웹 지도를 표시할 수 없습니다.</Text>
          </View>
        )
      ) : (
        <View style={styles.mapNative}>
          <KakaoMapWebView
            jsApiKey={kakaoJsKey}
            initialCenter={center}
            initialMarker={center}
            style={styles.mapNative}
          />
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>주소</Text>
        <Text style={styles.infoValue}>{mapAddress}</Text>
        <Text style={styles.infoMeta}>도로명: {location?.roadAddress ?? '-'}</Text>
        <Text style={styles.infoMeta}>지번: {location?.jibunAddress ?? '-'}</Text>
        <Text style={styles.infoMeta}>
          좌표: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </Text>
        <Text style={styles.infoMeta}>정확도: {accuracy ? `${accuracy.toFixed(1)}m` : '미측정'}</Text>
      </View>

      <LocationButton
        isLoading={isLoading}
        error={error}
        onPress={() => {
          void getCurrentLocation();
        }}
        onRetry={() => {
          void getCurrentLocation();
        }}
        onOpenSettings={() => {
          void Linking.openSettings();
        }}
      />

      <Text style={styles.hint}>웹 Geolocation API는 HTTPS(또는 localhost)에서만 동작합니다.</Text>
      <Text style={styles.hint}>Expo Go는 정확도가 낮을 수 있어 EAS Build 실기기 테스트를 권장합니다.</Text>

      {/*
      Android 대안 예시(주소만 REST로 받고 지도는 비노출)
      1) useCurrentLocation()으로 lat/lng + 주소를 얻는다.
      2) 주소 카드만 노출하고 지도는 생략한다.
      3) 상세 지도는 별도 WebView 화면으로 라우팅한다.
      현재 구현은 WebView 내 카카오맵 HTML 삽입 방식을 사용한다.
      */}
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
  mapWeb: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8EEF7',
  },
  mapNative: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8EEF7',
  },
  fallbackMapBox: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fallbackText: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  infoMeta: {
    fontSize: 12,
    color: '#334155',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
