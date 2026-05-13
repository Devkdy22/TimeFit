import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type WebCenter = {
  lat: number;
  lng: number;
};

type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

type KakaoMapInstance = {
  setCenter: (latLng: KakaoLatLng) => void;
};

type KakaoMarkerInstance = {
  setMap: (map: KakaoMapInstance) => void;
  setPosition: (latLng: KakaoLatLng) => void;
};

interface MapWebProps {
  jsApiKey: string;
  center: WebCenter;
  marker: WebCenter;
}

type KakaoWindow = Window & {
  kakao?: {
    maps: {
      load: (cb: () => void) => void;
      LatLng: new (lat: number, lng: number) => KakaoLatLng;
      Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
      Marker: new (options: { position: KakaoLatLng }) => KakaoMarkerInstance;
    };
  };
};

export function MapWeb({ jsApiKey, center, marker }: MapWebProps) {
  const containerId = useMemo(
    () => `kakao-web-map-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRef = useRef<KakaoMarkerInstance | null>(null);

  // 웹용 카카오 JS SDK 로딩 및 초기화
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!jsApiKey) {
      return;
    }

    const w = window as KakaoWindow;
    const sdkSelector = `script[data-kakao-js-key="${jsApiKey}"]`;

    const initMap = () => {
      const container = document.getElementById(containerId);
      if (!container || !w.kakao?.maps) {
        return;
      }

      const kakao = w.kakao;
      const centerLatLng = new kakao.maps.LatLng(center.lat, center.lng);
      const map = new kakao.maps.Map(container, {
        center: centerLatLng,
        level: 3,
      });
      const mapMarker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(marker.lat, marker.lng),
      });
      mapMarker.setMap(map);

      mapRef.current = map;
      markerRef.current = mapMarker;
    };

    const existing = document.querySelector<HTMLScriptElement>(sdkSelector);
    if (existing && w.kakao?.maps?.load) {
      w.kakao.maps.load(initMap);
      return;
    }

    const script = existing ?? document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsApiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.setAttribute('data-kakao-js-key', jsApiKey);
    script.onload = () => {
      if (!w.kakao?.maps?.load) {
        return;
      }
      w.kakao.maps.load(initMap);
    };

    if (!existing) {
      document.head.appendChild(script);
    }
  }, [center.lat, center.lng, containerId, jsApiKey, marker.lat, marker.lng]);

  // 중심/마커 좌표 업데이트
  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as KakaoWindow) : null;
    if (!w?.kakao?.maps || !mapRef.current || !markerRef.current) {
      return;
    }

    const nextCenter = new w.kakao.maps.LatLng(center.lat, center.lng);
    mapRef.current.setCenter(nextCenter);

    const nextMarker = new w.kakao.maps.LatLng(marker.lat, marker.lng);
    markerRef.current.setPosition(nextMarker);
  }, [center.lat, center.lng, marker.lat, marker.lng]);

  if (!jsApiKey) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>EXPO_PUBLIC_KAKAO_JS_KEY가 설정되지 않았습니다.</Text>
      </View>
    );
  }

  return <View nativeID={containerId} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E8EEF7',
  },
  fallback: {
    height: 280,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
  },
  fallbackText: {
    color: '#334155',
    fontSize: 13,
    textAlign: 'center',
  },
});
