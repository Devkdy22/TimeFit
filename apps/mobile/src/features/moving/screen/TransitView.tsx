import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MovingMapData } from '../../map/types';
import type { UiStatus } from '../../../theme/status-config';
import { KakaoMapWebView } from '../../map/webview/KakaoMapWebView';
import type { KakaoMapWebViewHandle } from '../../map/webview/types';
import type { KakaoMapWebViewEvent } from '../../map/webview/types';
import type { MapCoordinate } from '../../map/types';
import { HeroStatusCard } from './live/HeroStatusCard';
import { FloatingMapControls } from './live/FloatingMapControls';
import { LiveBottomSheet } from './live/LiveBottomSheet';
import type { LiveSheetProps, TransitLineItem } from './live/types';

export interface TransitViewProps {
  currentTime: string;
  arrivalTime: string;
  remainingTime: string;
  mainAction: string;
  stageText: string;
  supportText: string;
  upcomingActionTitle: string;
  upcomingActionSubtitle: string;
  upcomingActionTimeText: string;
  status: UiStatus;
  isDetailOpen: boolean;
  mapData: MovingMapData;
  originPin: MapCoordinate | null;
  destinationPin: MapCoordinate | null;
  routePathPoints: MapCoordinate[];
  detailLines: TransitLineItem[];
  onSetDetailOpen: (open: boolean) => void;
  onPressBack: () => void;
}

function toCoordKey(point: MapCoordinate | null | undefined): string {
  if (!point) return 'none';
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function toSegmentsKey(segments: MovingMapData['routeSegments']) {
  return segments.map((segment) => `${segment.id}:${segment.mode}:${segment.polyline.length}`).join('|');
}

function computePathCenter(points: MapCoordinate[]) {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export function TransitView({
  currentTime,
  arrivalTime,
  remainingTime,
  mainAction,
  stageText,
  supportText,
  upcomingActionTitle,
  upcomingActionSubtitle,
  status,
  isDetailOpen,
  mapData,
  originPin,
  destinationPin,
  routePathPoints,
  detailLines,
  onSetDetailOpen,
  onPressBack,
}: TransitViewProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<KakaoMapWebViewHandle>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const jsApiKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
  const heroTop = insets.top + 24;
  const sheetTopInset = heroTop + 136;
  const screenHeight = Dimensions.get('window').height;

  const [sheetIndex, setSheetIndex] = useState<number>(isDetailOpen ? 1 : 0);
  const [heroExpanded, setHeroExpanded] = useState(true);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const controlBottomOffset = useMemo(() => {
    const snapPercents = [30, 58, 88];
    const idx = Math.max(0, Math.min(2, sheetIndex));
    const sheetHeight = (screenHeight * snapPercents[idx]) / 100;
    return sheetHeight + 10;
  }, [screenHeight, sheetIndex]);

  const sheetData: LiveSheetProps = useMemo(
    () => ({
      status,
      currentTime,
      arrivalTime,
      remainingTime,
      mainAction,
      stageText,
      supportText,
      upcomingActionTitle,
      upcomingActionSubtitle,
      detailLines,
    }),
    [arrivalTime, currentTime, detailLines, mainAction, remainingTime, stageText, status, supportText, upcomingActionSubtitle, upcomingActionTitle],
  );

  useEffect(() => {
    if (isDetailOpen && sheetIndex < 1) {
      setSheetIndex(1);
      sheetRef.current?.snapToIndex(1);
    }
  }, [isDetailOpen, sheetIndex]);

  useEffect(() => {
    const currentIndex = Math.max(0, detailLines.findIndex((line) => line.isCurrent));
    const remainingStops = Math.max(0, detailLines.length - currentIndex - 1);
    const shouldAutoExpand = status === 'urgent' || remainingStops <= 1;
    if (!shouldAutoExpand) return;
    if (sheetIndex >= 1) return;
    setSheetIndex(1);
    sheetRef.current?.snapToIndex(1);
    onSetDetailOpen(true);
  }, [detailLines, onSetDetailOpen, sheetIndex, status]);

  const routeCenter = useMemo(() => computePathCenter(routePathPoints) ?? mapData.currentLocation, [mapData.currentLocation, routePathPoints]);

  const lastPinsKeyRef = useRef('');
  const lastSegmentsKeyRef = useRef('');

  useEffect(() => {
    if (routePathPoints.length >= 2 && mapData.routeSegments.length === 0) {
      mapRef.current?.setRoutePath(routePathPoints);
    }
  }, [mapData.routeSegments.length, routePathPoints]);

  useEffect(() => {
    const key = `${toCoordKey(originPin)}->${toCoordKey(destinationPin)}`;
    if (lastPinsKeyRef.current === key) return;
    lastPinsKeyRef.current = key;
    mapRef.current?.setPins({ origin: originPin, destination: destinationPin });
  }, [destinationPin, originPin]);

  useEffect(() => {
    const key = toSegmentsKey(mapData.routeSegments);
    if (lastSegmentsKeyRef.current === key) return;
    lastSegmentsKeyRef.current = key;
    mapRef.current?.setRouteSegments(mapData.routeSegments);
  }, [mapData.routeSegments]);

  useEffect(() => {
    mapRef.current?.setFitPaddingBottom((sheetIndex <= 0 ? 340 : sheetIndex === 1 ? 500 : 600) + insets.bottom);
  }, [insets.bottom, sheetIndex]);

  useEffect(() => {
    if (!autoFollow) return;
    mapRef.current?.moveTo(mapData.currentLocation);
    mapRef.current?.moveMarker(mapData.currentLocation);
  }, [autoFollow, mapData.currentLocation]);

  const handleMapEvent = useCallback((event: KakaoMapWebViewEvent) => {
    if (event.type === 'MAP_TAP') {
      collapseToDefault();
      return;
    }
    if (event.type !== 'MAP_READY') return;
    mapRef.current?.setPins({ origin: originPin, destination: destinationPin });
    if (routePathPoints.length >= 2 && mapData.routeSegments.length === 0) {
      mapRef.current?.setRoutePath(routePathPoints);
    }
    mapRef.current?.setRouteSegments(mapData.routeSegments);
  }, [collapseToDefault, destinationPin, mapData.routeSegments, originPin, routePathPoints]);

  const heroPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
        onPanResponderRelease: (_, g) => {
          if (g.dy < -20) setHeroExpanded(false);
          if (g.dy > 20) setHeroExpanded(true);
        },
      }),
    [],
  );

  const collapseToDefault = useCallback(() => {
    setSheetIndex(0);
    sheetRef.current?.snapToIndex(0);
    onSetDetailOpen(false);
    setStopsOpen(false);
  }, [onSetDetailOpen]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {jsApiKey ? (
        <KakaoMapWebView
          ref={mapRef}
          jsApiKey={jsApiKey}
          initialCenter={routeCenter}
          initialMarker={mapData.currentLocation}
          onEvent={handleMapEvent}
          style={styles.map}
        />
      ) : (
        <View style={[styles.map, styles.mapFallback]}>
          <Text style={styles.mapFallbackText}>카카오맵 키가 없어 지도를 표시할 수 없습니다.</Text>
        </View>
      )}

      <Pressable onPress={onPressBack} style={styles.backButton}>
        <Ionicons name="arrow-back-outline" size={24} color="#fff" />
      </Pressable>

      <View style={[styles.heroWrap, { top: heroTop }]} {...heroPanResponder.panHandlers}>
        <HeroStatusCard expanded={heroExpanded} onToggle={() => setHeroExpanded((v) => !v)} data={sheetData} />
      </View>

      <FloatingMapControls
        bottomOffset={controlBottomOffset}
        onCurrent={() => {
          setAutoFollow(true);
          mapRef.current?.moveTo(mapData.currentLocation);
        }}
        onOverview={() => mapRef.current?.moveTo(routeCenter)}
      />

      <LiveBottomSheet
        data={sheetData}
        sheetRef={sheetRef}
        index={sheetIndex}
        onChange={(idx) => {
          if (idx < 0) {
            setSheetIndex(0);
            sheetRef.current?.snapToIndex(0);
            onSetDetailOpen(false);
            return;
          }
          if (idx > 2) {
            setSheetIndex(2);
            sheetRef.current?.snapToIndex(2);
            onSetDetailOpen(true);
            return;
          }
          setSheetIndex(idx);
          onSetDetailOpen(idx >= 1);
        }}
        stopsOpen={stopsOpen}
        onToggleStops={() => setStopsOpen((v) => !v)}
        bottomInset={0}
        contentBottomPadding={24}
        topInset={sheetTopInset}
        onExpandFromSummary={() => {
          setSheetIndex(1);
          sheetRef.current?.snapToIndex(1);
          onSetDetailOpen(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  map: { ...StyleSheet.absoluteFillObject },
  mapFallback: { backgroundColor: '#D8E3F8', alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#35516F' },
  backButton: {
    position: 'absolute',
    top: 26,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15,23,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  heroWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 15 },
});
