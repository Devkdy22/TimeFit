import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KakaoMapWebView } from '../webview/KakaoMapWebView';
import type { KakaoMapWebViewEvent, KakaoMapWebViewHandle, MapCenterSource } from '../webview/types';

type MapCenter = {
  lat: number;
  lng: number;
  address?: string;
  source: MapCenterSource;
};

interface KakaoMapCrossPlatformProps {
  jsApiKey: string;
  center: MapCenter;
  style?: StyleProp<ViewStyle>;
  onCenterChange: (next: MapCenter) => void;
  onGeocodeResult?: (info: {
    lat: number;
    lng: number;
    roadAddress: string | null;
    jibunAddress: string | null;
    representativeJibun: string | null;
  }) => void;
}

type KakaoMapsGlobal = {
  maps: {
    load: (callback: () => void) => void;
    Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMapInstance;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Marker: new (options: { position: KakaoLatLng }) => KakaoMarker;
    event: {
      addListener: (target: unknown, eventName: string, listener: () => void) => void;
      removeListener?: (target: unknown, eventName: string, listener: () => void) => void;
    };
    services?: {
      Geocoder: new () => {
        coord2Address: (
          lng: number,
          lat: number,
          callback: (
            result: Array<{
              road_address?: { address_name?: string };
              address?: { address_name?: string };
            }>,
            status: string,
          ) => void,
        ) => void;
      };
      Status: {
        OK: string;
      };
    };
  };
};

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoMapInstance {
  setCenter: (latLng: KakaoLatLng) => void;
  getCenter: () => KakaoLatLng;
}

interface KakaoMarker {
  setMap: (map: KakaoMapInstance | null) => void;
  setPosition: (latLng: KakaoLatLng) => void;
}

declare global {
  interface Window {
    kakao?: KakaoMapsGlobal;
  }
}

const SDK_SCRIPT_SELECTOR = 'script[data-kakao-map-sdk-key]';
const sdkLoadPromiseByKey = new Map<string, Promise<KakaoMapsGlobal>>();

function maskKey(key: string) {
  if (!key) {
    return '(empty)';
  }

  if (key.length <= 6) {
    return `${key.slice(0, 2)}***`;
  }

  return `${key.slice(0, 4)}...${key.slice(-2)}`;
}

function logMap(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.info('[KakaoMapCrossPlatform]', message, data);
    return;
  }

  console.info('[KakaoMapCrossPlatform]', message);
}

function findSdkScriptByKey(apiKey: string) {
  return document.querySelector<HTMLScriptElement>(`script[data-kakao-map-sdk-key="${apiKey}"]`);
}

function resetKakaoSdkState(apiKey?: string) {
  const scripts = document.querySelectorAll<HTMLScriptElement>(SDK_SCRIPT_SELECTOR);
  scripts.forEach((script) => {
    const scriptKey = script.dataset.kakaoMapSdkKey ?? '';
    if (!apiKey || scriptKey === apiKey) {
      script.remove();
    }
  });

  if (apiKey) {
    sdkLoadPromiseByKey.delete(apiKey);
  } else {
    sdkLoadPromiseByKey.clear();
  }

  delete window.kakao;
}

function waitForContainer(containerId: string, timeoutMs = 1500): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const poll = () => {
      const container = document.getElementById(containerId);
      if (container) {
        resolve(container);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`map container not found: ${containerId}`));
        return;
      }

      window.requestAnimationFrame(poll);
    };

    poll();
  });
}

function injectOrReuseKakaoSdkScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    const existing = findSdkScriptByKey(apiKey);

    if (existing) {
      if (window.kakao?.maps?.load) {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('existing kakao sdk script failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.kakaoMapSdkKey = apiKey;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('failed to load kakao sdk script'));
    document.head.appendChild(script);
  });
}

export async function loadKakaoSdk(apiKey: string, maxRetry = 2): Promise<KakaoMapsGlobal> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('window/document unavailable');
  }

  if (!apiKey) {
    throw new Error('kakao javascript key unavailable');
  }

  const scriptWithDifferentKey = document.querySelector<HTMLScriptElement>(
    `script[data-kakao-map-sdk-key]:not([data-kakao-map-sdk-key="${apiKey}"])`,
  );

  if (scriptWithDifferentKey) {
    logMap('SDK key mismatch detected; resetting SDK state', {
      keyType: 'JS',
      expectedKey: maskKey(apiKey),
      existingKey: maskKey(scriptWithDifferentKey.dataset.kakaoMapSdkKey ?? ''),
    });
    resetKakaoSdkState();
  }

  const cached = sdkLoadPromiseByKey.get(apiKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    let attempt = 0;

    while (attempt <= maxRetry) {
      attempt += 1;
      logMap('SDK load start', {
        keyType: 'JS',
        key: maskKey(apiKey),
        attempt,
      });

      try {
        await injectOrReuseKakaoSdkScript(apiKey);

        if (!window.kakao?.maps?.load) {
          throw new Error('kakao maps load unavailable after sdk script load');
        }

        const kakao = await new Promise<KakaoMapsGlobal>((resolve, reject) => {
          window.kakao?.maps.load(() => {
            if (!window.kakao) {
              reject(new Error('window.kakao missing after maps.load'));
              return;
            }
            resolve(window.kakao);
          });
        });

        logMap('SDK load success', {
          keyType: 'JS',
          key: maskKey(apiKey),
          attempt,
        });
        return kakao;
      } catch (error) {
        logMap('SDK load fail', {
          keyType: 'JS',
          key: maskKey(apiKey),
          attempt,
          message: error instanceof Error ? error.message : String(error),
        });

        resetKakaoSdkState(apiKey);

        if (attempt > maxRetry) {
          throw error;
        }
      }
    }

    throw new Error('unreachable sdk load state');
  })();

  sdkLoadPromiseByKey.set(apiKey, promise);

  try {
    return await promise;
  } catch (error) {
    sdkLoadPromiseByKey.delete(apiKey);
    throw error;
  }
}

function isSameCenter(a: Pick<MapCenter, 'lat' | 'lng'>, b: Pick<MapCenter, 'lat' | 'lng'>, epsilon = 0.000002) {
  return Math.abs(a.lat - b.lat) <= epsilon && Math.abs(a.lng - b.lng) <= epsilon;
}

function parseJibunParts(jibunAddress: string): { region: string; lotMain: string } | null {
  const trimmed = jibunAddress.trim();
  if (!trimmed) {
    return null;
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }
  const lotToken = tokens[tokens.length - 1];
  const lotMatch = lotToken.match(/^(\d+)(?:-\d+)?$/);
  if (!lotMatch?.[1]) {
    return null;
  }
  const region = tokens.slice(0, -1).join(' ').trim();
  if (!region) {
    return null;
  }
  return {
    region,
    lotMain: lotMatch[1],
  };
}

function pickRepresentativeJibun(addresses: string[]) {
  const groups = new Map<string, number>();
  for (const address of addresses) {
    const parsed = parseJibunParts(address);
    if (!parsed) {
      continue;
    }
    const key = `${parsed.region} ${parsed.lotMain}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  let selected: { key: string; count: number } | null = null;
  for (const [key, count] of groups.entries()) {
    if (!selected || count > selected.count) {
      selected = { key, count };
    }
  }

  return selected?.key ?? null;
}

export function KakaoMapCrossPlatform({
  jsApiKey,
  center,
  style,
  onCenterChange,
  onGeocodeResult,
}: KakaoMapCrossPlatformProps) {
  const containerId = useMemo(() => `kakao-map-container-${Math.random().toString(36).slice(2, 10)}`, []);

  const mapRef = useRef<KakaoMapInstance | null>(null);
  const markerRef = useRef<KakaoMarker | null>(null);
  const nativeMapRef = useRef<KakaoMapWebViewHandle | null>(null);
  const geocoderRef = useRef<InstanceType<NonNullable<KakaoMapsGlobal['maps']['services']>['Geocoder']> | null>(null);
  const mapListenersRef = useRef<Array<{ name: 'dragend' | 'zoom_changed'; handler: () => void }>>([]);
  const geocoderRequestSeqRef = useRef(0);
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedCenterRef = useRef<MapCenter | null>(null);
  const latestCenterPropRef = useRef<MapCenter>(center);
  const onCenterChangeRef = useRef(onCenterChange);
  const onGeocodeResultRef = useRef(onGeocodeResult);
  const initSeqRef = useRef(0);
  const isMountedRef = useRef(true);
  const pendingNativeMoveRef = useRef<MapCenter | null>(null);
  const nativeInitialCenterRef = useRef<MapCenter | null>(null);
  const pendingProgrammaticSourceRef = useRef<MapCenterSource | null>(null);
  const gpsCenterAppliedRef = useRef(false);

  onCenterChangeRef.current = onCenterChange;
  onGeocodeResultRef.current = onGeocodeResult;
  latestCenterPropRef.current = center;

  if (!nativeInitialCenterRef.current) {
    nativeInitialCenterRef.current = {
      lat: center.lat,
      lng: center.lng,
      address: center.address,
      source: center.source,
    };
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    if (!jsApiKey) {
      logMap('SDK load fail', {
        keyType: 'JS',
        message: 'jsApiKey missing',
      });
      return;
    }

    let disposed = false;
    const initSeq = ++initSeqRef.current;

    const clearMap = (kakao?: KakaoMapsGlobal) => {
      if (geocodeDebounceRef.current) {
        clearTimeout(geocodeDebounceRef.current);
        geocodeDebounceRef.current = null;
      }

      geocoderRequestSeqRef.current += 1;
      geocoderRef.current = null;

      const map = mapRef.current;
      if (map && kakao?.maps?.event?.removeListener) {
        mapListenersRef.current.forEach(({ name, handler }) => {
          kakao.maps.event.removeListener?.(map, name, handler);
        });
      }
      mapListenersRef.current = [];

      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      markerRef.current = null;
      mapRef.current = null;
    };

    const emitCenter = (
      kakao: KakaoMapsGlobal,
      reason: 'dragend' | 'zoom_changed' | 'init' | 'programmatic',
      force = false,
    ) => {
      if (!mapRef.current) {
        return;
      }

      const currentCenter = mapRef.current.getCenter();
      const lat = currentCenter.getLat();
      const lng = currentCenter.getLng();
      const nextCenter = { lat, lng };
      const resolvedSource: MapCenterSource =
        reason === 'init' ? 'init' : reason === 'programmatic' ? pendingProgrammaticSourceRef.current ?? 'gps' : 'user';

      const prevCenter = lastEmittedCenterRef.current;
      if (!force && prevCenter && isSameCenter(prevCenter, nextCenter)) {
        return;
      }

      lastEmittedCenterRef.current = { ...nextCenter, source: resolvedSource };

      if (geocodeDebounceRef.current) {
        clearTimeout(geocodeDebounceRef.current);
      }

      const requestId = ++geocoderRequestSeqRef.current;
      geocodeDebounceRef.current = setTimeout(() => {
        if (!isMountedRef.current || disposed || initSeq !== initSeqRef.current) {
          return;
        }

        if (!geocoderRef.current || !kakao.maps.services?.Status?.OK) {
          logMap('geocoder result', {
            keyType: 'JS',
            reason,
            source: resolvedSource,
            ok: false,
            message: 'geocoder unavailable',
            lat,
            lng,
          });
          onCenterChangeRef.current({ lat, lng, source: resolvedSource });
          pendingProgrammaticSourceRef.current = null;
          return;
        }

        geocoderRef.current.coord2Address(lng, lat, (result, status) => {
          if (!isMountedRef.current || disposed || requestId !== geocoderRequestSeqRef.current) {
            return;
          }

          if (status !== kakao.maps.services?.Status?.OK || !result?.[0]) {
            logMap('geocoder result', {
              keyType: 'JS',
              reason,
              source: resolvedSource,
              ok: false,
              status,
              lat,
              lng,
            });
            onCenterChangeRef.current({ lat, lng, source: resolvedSource });
            pendingProgrammaticSourceRef.current = null;
            return;
          }

          const roadAddress = result[0].road_address?.address_name?.trim();
          const jibunAddress = result[0].address?.address_name?.trim();
          const address = roadAddress || jibunAddress;
          const sampleOffsets: Array<[number, number]> = [
            [0, 0],
            [0.00005, 0],
            [-0.00005, 0],
            [0, 0.00005],
            [0, -0.00005],
          ];

          Promise.all(
            sampleOffsets.map(
              ([dLat, dLng]) =>
                new Promise<string | null>((resolve) => {
                  geocoderRef.current?.coord2Address(lng + dLng, lat + dLat, (sampleResult, sampleStatus) => {
                    if (sampleStatus !== kakao.maps.services?.Status?.OK || !sampleResult?.[0]) {
                      resolve(null);
                      return;
                    }
                    resolve(sampleResult[0].address?.address_name?.trim() || null);
                  });
                }),
            ),
          )
            .then((sampledJibunAddresses) => {
              if (!isMountedRef.current || disposed || requestId !== geocoderRequestSeqRef.current) {
                return;
              }

              const representativeJibun = pickRepresentativeJibun(
                sampledJibunAddresses.filter((item): item is string => Boolean(item)),
              );

              logMap('geocoder result', {
                keyType: 'JS',
                reason,
                source: resolvedSource,
                ok: true,
                lat,
                lng,
                address,
                representativeJibun,
              });

              onCenterChangeRef.current({ lat, lng, address, source: resolvedSource });
              onGeocodeResultRef.current?.({
                lat,
                lng,
                roadAddress: roadAddress ?? null,
                jibunAddress: jibunAddress ?? null,
                representativeJibun,
              });
              pendingProgrammaticSourceRef.current = null;
            })
            .catch(() => {
              if (!isMountedRef.current || disposed || requestId !== geocoderRequestSeqRef.current) {
                return;
              }

              onCenterChangeRef.current({ lat, lng, address, source: resolvedSource });
              onGeocodeResultRef.current?.({
                lat,
                lng,
                roadAddress: roadAddress ?? null,
                jibunAddress: jibunAddress ?? null,
                representativeJibun: null,
              });
              pendingProgrammaticSourceRef.current = null;
            });
        });
      }, 140);
    };

    const initialize = async () => {
      try {
        const kakao = await loadKakaoSdk(jsApiKey);
        if (disposed || initSeq !== initSeqRef.current) {
          return;
        }

        const container = await waitForContainer(containerId);
        if (disposed || initSeq !== initSeqRef.current) {
          return;
        }

        clearMap(kakao);

        const centerLatLng = new kakao.maps.LatLng(center.lat, center.lng);
        const map = new kakao.maps.Map(container, {
          center: centerLatLng,
          level: 3,
        });
        mapRef.current = map;

        const marker = new kakao.maps.Marker({
          position: centerLatLng,
        });
        marker.setMap(map);
        markerRef.current = marker;

        if (kakao.maps.services?.Geocoder) {
          geocoderRef.current = new kakao.maps.services.Geocoder();
        }

        const onDragEnd = () => emitCenter(kakao, 'dragend');
        const onZoomChanged = () => emitCenter(kakao, 'zoom_changed');

        kakao.maps.event.addListener(map, 'dragend', onDragEnd);
        kakao.maps.event.addListener(map, 'zoom_changed', onZoomChanged);
        mapListenersRef.current = [
          { name: 'dragend', handler: onDragEnd },
          { name: 'zoom_changed', handler: onZoomChanged },
        ];

        emitCenter(kakao, 'init', true);

        logMap('map init success', {
          keyType: 'JS',
          center: { lat: center.lat, lng: center.lng },
        });
      } catch (error) {
        logMap('map init fail', {
          keyType: 'JS',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void initialize();

    return () => {
      disposed = true;
      clearMap(window.kakao);
    };
  }, [jsApiKey, containerId]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const pending = pendingNativeMoveRef.current;
      const alreadySame = pending ? isSameCenter(pending, center) : false;

      if (alreadySame) {
        pendingNativeMoveRef.current = null;
        return;
      }

      if (center.source !== 'gps') {
        logMap('setCenter skipped', {
          source: center.source,
          reason: 'native center effect',
        });
        return;
      }

      if (gpsCenterAppliedRef.current) {
        logMap('setCenter skipped', {
          source: center.source,
          reason: 'native gps already applied once',
        });
        return;
      }

      logMap('setCenter called', {
        source: center.source,
        reason: 'native center effect',
        lat: center.lat,
        lng: center.lng,
      });
      pendingNativeMoveRef.current = { lat: center.lat, lng: center.lng, address: center.address, source: center.source };
      nativeMapRef.current?.moveTo({ lat: center.lat, lng: center.lng, source: center.source });
      gpsCenterAppliedRef.current = true;
      return;
    }

    if (!window.kakao || !mapRef.current || !markerRef.current) {
      return;
    }

    const current = mapRef.current.getCenter();
    const currentCenter = { lat: current.getLat(), lng: current.getLng() };

    if (isSameCenter(currentCenter, center)) {
      return;
    }

    if (center.source !== 'gps') {
      logMap('setCenter skipped', {
        source: center.source,
        reason: 'web center effect',
      });
      return;
    }

    if (gpsCenterAppliedRef.current) {
      logMap('setCenter skipped', {
        source: center.source,
        reason: 'web gps already applied once',
      });
      return;
    }

    logMap('setCenter called', {
      source: center.source,
      reason: 'web center effect',
      lat: center.lat,
      lng: center.lng,
    });
    pendingProgrammaticSourceRef.current = center.source;
    const next = new window.kakao.maps.LatLng(center.lat, center.lng);
    mapRef.current.setCenter(next);
    markerRef.current.setPosition(next);
    gpsCenterAppliedRef.current = true;
  }, [center.lat, center.lng, center.address, center.source]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <View nativeID={containerId} style={styles.webContainer} />
      </View>
    );
  }

  const handleWebViewEvent = (event: KakaoMapWebViewEvent) => {
    if (event.type === 'MAP_LOG') {
      logMap(event.message, {
        keyType: event.keyType,
        source: 'webview',
        ...(event.meta ?? {}),
      });
      return;
    }

    if (event.type === 'MAP_READY') {
      logMap('map init success', {
        keyType: 'JS',
        source: 'webview',
      });
      return;
    }

    if (event.type === 'MAP_ERROR') {
      logMap('map init fail', {
        keyType: 'JS',
        source: 'webview',
        message: event.message,
      });
      return;
    }

    if (event.type !== 'MAP_MOVED') {
      return;
    }

    if (isSameCenter(event, latestCenterPropRef.current, 0.00005)) {
      return;
    }

    const pending = pendingNativeMoveRef.current;
    if (pending && isSameCenter(pending, event)) {
      pendingNativeMoveRef.current = null;
      return;
    }

    onCenterChange({
      lat: event.lat,
      lng: event.lng,
      address: event.address,
      source: event.source ?? (event.reason === 'init' ? 'init' : 'user'),
    });
    onGeocodeResultRef.current?.({
      lat: event.lat,
      lng: event.lng,
      roadAddress: event.roadAddress ?? null,
      jibunAddress: event.jibunAddress ?? null,
      representativeJibun: event.representativeJibun ?? null,
    });
  };

  return (
    <KakaoMapWebView
      ref={nativeMapRef}
      jsApiKey={jsApiKey}
      initialCenter={{
        lat: nativeInitialCenterRef.current.lat,
        lng: nativeInitialCenterRef.current.lng,
      }}
      initialMarker={{
        lat: nativeInitialCenterRef.current.lat,
        lng: nativeInitialCenterRef.current.lng,
      }}
      onEvent={handleWebViewEvent}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 210,
    backgroundColor: '#E8EEF7',
  },
});
