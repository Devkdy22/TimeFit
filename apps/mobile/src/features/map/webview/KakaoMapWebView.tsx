import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
  type WebViewProps,
} from 'react-native-webview';
import type { MapCoordinate } from '../types';
import { buildKakaoMapHtml } from './html';
import type { KakaoMapWebViewEvent, KakaoMapWebViewHandle, KakaoMapWebViewProps, MapCenterSource } from './types';

function resolveWebViewBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_KAKAO_WEBVIEW_BASE_URL ?? 'http://localhost:8080';

  try {
    const parsed = new URL(raw);
    if (!parsed.protocol || !parsed.hostname) {
      throw new Error('invalid base url');
    }

    return parsed.toString();
  } catch {
    return 'http://localhost:8080';
  }
}

const WEBVIEW_BASE_URL = resolveWebViewBaseUrl();

function parseMessage(event: WebViewMessageEvent): KakaoMapWebViewEvent | null {
  try {
    const parsed = JSON.parse(event.nativeEvent.data) as KakaoMapWebViewEvent;
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildMoveToScript(coordinate: MapCoordinate & { source?: MapCenterSource }): string {
  const source = coordinate.source ? `'${coordinate.source}'` : 'undefined';
  return `window.moveTo && window.moveTo(${coordinate.lat}, ${coordinate.lng}, ${source}); true;`;
}

export const KakaoMapWebView = forwardRef<KakaoMapWebViewHandle, KakaoMapWebViewProps>(
  function KakaoMapWebView({ jsApiKey, initialCenter, initialMarker, style, onEvent }, ref) {
    const webViewRef = useRef<WebView>(null);
    const initialCenterRef = useRef(initialCenter);
    const initialMarkerRef = useRef(initialMarker);

    const html = useMemo(
      () =>
        buildKakaoMapHtml({
          jsApiKey,
          initialCenter: initialCenterRef.current,
          initialMarker: initialMarkerRef.current,
        }),
      [jsApiKey],
    );

    useImperativeHandle(
      ref,
      () => ({
        moveTo(coordinate: MapCoordinate) {
          webViewRef.current?.injectJavaScript(buildMoveToScript(coordinate));
        },
      }),
      [],
    );

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const parsed = parseMessage(event);
        if (!parsed) {
          return;
        }
        onEvent?.(parsed);
      },
      [onEvent],
    );

    const handleLayout = useCallback((_event: LayoutChangeEvent) => {
      // no-op to ensure view is measured before WebView draws in some Android devices.
    }, []);

    const handleError = useCallback(
      (event: Parameters<NonNullable<WebViewProps['onError']>>[0]) => {
        const nativeEvent = event.nativeEvent;
        onEvent?.({
          type: 'MAP_ERROR',
          message: `webview error code=${nativeEvent.code} desc=${nativeEvent.description} url=${nativeEvent.url}`,
        });
      },
      [onEvent],
    );

    const handleHttpError = useCallback(
      (event: Parameters<NonNullable<WebViewProps['onHttpError']>>[0]) => {
        const nativeEvent = event.nativeEvent;
        onEvent?.({
          type: 'MAP_ERROR',
          message: `webview http error status=${nativeEvent.statusCode} url=${nativeEvent.url}`,
        });
      },
      [onEvent],
    );

    const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
      if (request.url.startsWith('https://dapi.kakao.com/')) {
        return true;
      }
      return true;
    }, []);

    return (
      <View style={[styles.container, style as StyleProp<ViewStyle>]} onLayout={handleLayout}>
        <WebView
          ref={webViewRef}
          style={styles.webview}
          originWhitelist={['*']}
          source={{ html, baseUrl: WEBVIEW_BASE_URL }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleHttpError}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          setSupportMultipleWindows={false}
          mixedContentMode="always"
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EEF7',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
