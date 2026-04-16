import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KakaoMapWebView } from '../webview/KakaoMapWebView';
import type { KakaoMapWebViewEvent, KakaoMapWebViewHandle } from '../webview/types';
import type { MapCoordinate } from '../types';
import { theme } from '../../../theme/theme';

const KAKAO_JAVASCRIPT_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

const INITIAL_COORDINATE: MapCoordinate = { lat: 37.5665, lng: 126.978 };
const MOVED_COORDINATE: MapCoordinate = { lat: 37.57, lng: 126.9768 };

export function TestMapScreen() {
  const mapRef = useRef<KakaoMapWebViewHandle>(null);
  const [isMoved, setIsMoved] = useState(false);
  const [current, setCurrent] = useState<MapCoordinate>(INITIAL_COORDINATE);
  const [statusText, setStatusText] = useState('지도 초기화 대기');

  const nextButtonText = useMemo(
    () => (isMoved ? '초기 좌표로 이동' : '테스트 좌표로 이동'),
    [isMoved],
  );

  const handleMapEvent = useCallback((event: KakaoMapWebViewEvent) => {
    if (event.type === 'MAP_BOOT') {
      setStatusText(`MAP_BOOT: ${event.href}`);
      console.log('MAP_BOOT', event.href);
      return;
    }

    if (event.type === 'MAP_READY') {
      setStatusText('MAP_READY');
      console.log('MAP_READY');
      return;
    }

    if (event.type === 'MAP_MOVED') {
      setStatusText(`MAP_MOVED: ${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`);
      return;
    }

    if (event.type === 'MAP_ERROR') {
      setStatusText(`MAP_ERROR: ${event.message}`);
      console.error('MAP_ERROR', event.message);
    }
  }, []);

  const handleMove = useCallback(() => {
    const next = isMoved ? INITIAL_COORDINATE : MOVED_COORDINATE;
    mapRef.current?.moveTo(next);
    setCurrent(next);
    setIsMoved((prev) => !prev);
  }, [isMoved]);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {KAKAO_JAVASCRIPT_KEY ? (
          <KakaoMapWebView
            ref={mapRef}
            apiKey={KAKAO_JAVASCRIPT_KEY}
            initialCenter={INITIAL_COORDINATE}
            initialMarker={INITIAL_COORDINATE}
            onEvent={handleMapEvent}
            style={styles.map}
          />
        ) : (
          <View style={[styles.map, styles.missingKeyWrap]}>
            <Text style={styles.missingKeyText}>EXPO_PUBLIC_KAKAO_JS_KEY가 없습니다.</Text>
          </View>
        )}
      </View>

      <View style={styles.controlPanel}>
        <Text style={styles.title}>Kakao Map WebView Test</Text>
        <Text style={styles.caption}>
          center: {current.lat.toFixed(4)}, {current.lng.toFixed(4)}
        </Text>
        <Text style={styles.caption}>status: {statusText}</Text>
        <Text style={styles.caption}>jsKey: {KAKAO_JAVASCRIPT_KEY.slice(0, 6)}...</Text>

        <Pressable style={styles.button} onPress={handleMove}>
          <Text style={styles.buttonText}>{nextButtonText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controlPanel: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.background.elevated,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
  },
  title: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
  caption: {
    ...theme.typography.caption.md,
    color: theme.colors.text.secondary,
  },
  button: {
    minHeight: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  buttonText: {
    ...theme.typography.body.strong,
    color: '#FFFFFF',
  },
  missingKeyWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EEF7',
  },
  missingKeyText: {
    ...theme.typography.body.strong,
    color: theme.colors.text.primary,
  },
});
