import { useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeTabBar } from '../../../components/home';
import type { MovingMapData } from '../../map/types';
import type { UiStatus } from '../../../theme/status-config';
import { KakaoMapWebView } from '../../map/webview/KakaoMapWebView';
import type { KakaoMapWebViewHandle } from '../../map/webview/types';
import type { MapCoordinate } from '../../map/types';

interface TransitLineItem {
  id: string;
  mode: 'walk' | 'bus' | 'subway';
  lineLabel: string;
  etaText: string;
  stopName: string;
  isCurrent: boolean;
}

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

function modeIcon(mode: TransitLineItem['mode']) {
  if (mode === 'walk') return 'walk-outline';
  if (mode === 'bus') return 'bus-outline';
  return 'train-outline';
}

function statusColor(status: UiStatus) {
  if (status === 'urgent') return '#EF4444';
  if (status === 'warning') return '#F59E0B';
  return '#58C7C2';
}

function statusLabel(status: UiStatus) {
  if (status === 'urgent') return '긴급';
  if (status === 'warning') return '주의';
  return '여유';
}

function toMeters(a: MapCoordinate, b: MapCoordinate) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function blendCoordinate(prev: MapCoordinate, next: MapCoordinate, alpha: number): MapCoordinate {
  return {
    lat: prev.lat + (next.lat - prev.lat) * alpha,
    lng: prev.lng + (next.lng - prev.lng) * alpha,
  };
}

function stepToward(prev: MapCoordinate, next: MapCoordinate, maxMeters = 14): MapCoordinate {
  const distance = toMeters(prev, next);
  if (distance <= maxMeters) {
    return next;
  }
  const ratio = maxMeters / distance;
  return blendCoordinate(prev, next, ratio);
}

function projectOnSegment(point: MapCoordinate, a: MapCoordinate, b: MapCoordinate) {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const abNorm = abLat * abLat + abLng * abLng;
  if (abNorm <= 0) {
    return {
      t: 0,
      point: a,
      distanceMeters: toMeters(point, a),
    };
  }

  const apLat = point.lat - a.lat;
  const apLng = point.lng - a.lng;
  const t = Math.max(0, Math.min(1, (apLat * abLat + apLng * abLng) / abNorm));
  const projected = {
    lat: a.lat + abLat * t,
    lng: a.lng + abLng * t,
  };
  return {
    t,
    point: projected,
    distanceMeters: toMeters(point, projected),
  };
}

function findSnapOnPath(
  points: MapCoordinate[],
  target: MapCoordinate,
  hintProgress: number,
) {
  if (points.length < 2) {
    return null;
  }

  const maxSegment = points.length - 2;
  const hintIndex = Math.max(0, Math.min(maxSegment, Math.floor(hintProgress)));
  const start = Math.max(0, hintIndex - 8);
  const end = Math.min(maxSegment, hintIndex + 72);
  let best:
    | {
        progress: number;
        distanceMeters: number;
      }
    | null = null;

  for (let index = start; index <= end; index += 1) {
    const projected = projectOnSegment(target, points[index], points[index + 1]);
    if (!best || projected.distanceMeters < best.distanceMeters) {
      best = {
        progress: index + projected.t,
        distanceMeters: projected.distanceMeters,
      };
    }
  }

  return best;
}

function buildPathUntilProgress(points: MapCoordinate[], progress: number): MapCoordinate[] {
  if (points.length < 2) {
    return points;
  }
  const maxProgress = points.length - 1;
  const clamped = Math.max(0, Math.min(maxProgress, progress));
  const fullIndex = Math.floor(clamped);
  const fraction = clamped - fullIndex;

  const traveled = points.slice(0, fullIndex + 1);
  if (fraction > 0.0001 && fullIndex < points.length - 1) {
    traveled.push(blendCoordinate(points[fullIndex], points[fullIndex + 1], fraction));
  }
  return traveled;
}

export function TransitView({
  remainingTime,
  mainAction,
  stageText,
  upcomingActionTitle,
  upcomingActionSubtitle,
  upcomingActionTimeText,
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
  const tone = statusColor(status);
  const statusText = statusLabel(status);
  const homeTabStatus = status === 'relaxed' ? 'relaxed' : status === 'warning' ? 'warning' : 'urgent';
  const jsApiKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
  const smoothedLocationRef = useRef<MapCoordinate | null>(null);
  const lastRouteProgressRef = useRef(0);

  useEffect(() => {
    smoothedLocationRef.current = mapData.currentLocation;
    lastRouteProgressRef.current = 0;
  }, [mapData.routePath.id]);

  useEffect(() => {
    const prev = smoothedLocationRef.current;
    if (!prev) {
      smoothedLocationRef.current = mapData.currentLocation;
      mapRef.current?.moveTo(mapData.currentLocation);
      mapRef.current?.moveMarker(mapData.currentLocation);
      return;
    }
    const clamped = stepToward(prev, mapData.currentLocation, 14);
    const smoothed = blendCoordinate(prev, clamped, 0.35);
    smoothedLocationRef.current = smoothed;
    mapRef.current?.moveTo(smoothed);
    mapRef.current?.moveMarker(smoothed);
  }, [mapData.currentLocation, mapData.routePath.id]);

  useEffect(() => {
    mapRef.current?.setPins({ origin: originPin, destination: destinationPin });
  }, [destinationPin, originPin]);

  useEffect(() => {
    mapRef.current?.setRouteSegments(mapData.routeSegments);
  }, [mapData.routeSegments]);

  useEffect(() => {
    if (routePathPoints.length < 2) return;
    const current = smoothedLocationRef.current ?? mapData.currentLocation;
    const snapped = findSnapOnPath(routePathPoints, current, lastRouteProgressRef.current);
    if (!snapped || snapped.distanceMeters > 120) {
      return;
    }

    const previousProgress = lastRouteProgressRef.current;
    const forwardLimited = Math.min(snapped.progress, previousProgress + 36);
    const monotonicProgress = Math.max(previousProgress, forwardLimited);
    lastRouteProgressRef.current = Math.min(routePathPoints.length - 1, monotonicProgress);
    const traveled = buildPathUntilProgress(routePathPoints, lastRouteProgressRef.current);
    mapRef.current?.setTraveledPath(traveled);
  }, [mapData.currentLocation, routePathPoints, mapData.routePath.id]);

  const collapsedHeight = 352;
  const expandedHeight = 640;
  const sheetHeight = useRef(
    new Animated.Value(isDetailOpen ? expandedHeight : collapsedHeight),
  ).current;
  const sheetHeightRef = useRef(isDetailOpen ? expandedHeight : collapsedHeight);
  const panStartHeightRef = useRef(isDetailOpen ? expandedHeight : collapsedHeight);

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      sheetHeightRef.current = value;
    });
    return () => sheetHeight.removeListener(id);
  }, [sheetHeight]);

  useEffect(() => {
    Animated.spring(sheetHeight, {
      toValue: isDetailOpen ? expandedHeight : collapsedHeight,
      speed: 18,
      bounciness: 0,
      useNativeDriver: false,
    }).start();
  }, [collapsedHeight, expandedHeight, isDetailOpen, sheetHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6,
        onPanResponderGrant: () => {
          panStartHeightRef.current = sheetHeightRef.current;
        },
        onPanResponderMove: (_, gs) => {
          const next = Math.max(
            collapsedHeight,
            Math.min(expandedHeight, panStartHeightRef.current - gs.dy),
          );
          sheetHeight.setValue(next);
        },
        onPanResponderRelease: (_, gs) => {
          const projected = sheetHeightRef.current - gs.dy * 0.18;
          const midpoint = collapsedHeight + (expandedHeight - collapsedHeight) * 0.45;
          const shouldOpen = gs.vy < -0.35 || projected > midpoint;
          onSetDetailOpen(shouldOpen);
        },
      }),
    [collapsedHeight, expandedHeight, onSetDetailOpen, sheetHeight],
  );
  const currentDetailIndex = Math.max(
    0,
    detailLines.findIndex((line) => line.isCurrent),
  );
  const homeTabBarReserved = 96 + Math.max(8, insets.bottom);

  return (
    <SafeAreaView style={styles.safeArea}>
      {jsApiKey ? (
        <KakaoMapWebView
          ref={mapRef}
          jsApiKey={jsApiKey}
          initialCenter={mapData.currentLocation}
          initialMarker={mapData.currentLocation}
          style={styles.map}
        />
      ) : (
        <View style={[styles.map, styles.mapFallback]}>
          <Text style={styles.mapFallbackText}>카카오맵 키가 없어 지도를 표시할 수 없습니다.</Text>
        </View>
      )}

      {isDetailOpen ? (
        <Pressable style={styles.mapDismissOverlay} onPress={() => onSetDetailOpen(false)} />
      ) : null}

      <Pressable onPress={onPressBack} style={styles.backButton}>
        <Ionicons name="arrow-back-outline" size={24} color="#FFFFFF" />
      </Pressable>

      <View style={styles.mapStatusPill}>
        <Text style={styles.mapStatusText}>{statusText}</Text>
      </View>

      <Animated.View
        style={[styles.bottomPanel, { height: sheetHeight, bottom: homeTabBarReserved }]}
      >
        <View pointerEvents="none" style={styles.gradientLayerBase} />
        <View pointerEvents="none" style={styles.gradientLayerTint} />
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={styles.grabber} />
        </View>

        <Pressable onPress={() => onSetDetailOpen(!isDetailOpen)} style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={[styles.hintPill, { backgroundColor: `${tone}22` }]}>
              <Text style={[styles.hintText, { color: tone }]}>여유있게 이동하셔도 돼요!</Text>
            </View>
            <View style={styles.remainingTimeWrap}>
              <Text style={[styles.remainingTimeValue, { color: tone }]}>{remainingTime}</Text>
            </View>
          </View>

          <Text style={styles.mainAction} numberOfLines={2}>
            {mainAction}
          </Text>
          <Text style={styles.support}>{stageText}</Text>

          <View style={styles.nextCard}>
            <View style={styles.nextIconWrap}>
              <Ionicons name="notifications-outline" size={14} color={tone} />
            </View>
            <View style={styles.nextTextWrap}>
              <Text style={styles.nextTitle}>{upcomingActionTitle}</Text>
              <Text style={styles.nextSubtitle}>{upcomingActionSubtitle}</Text>
            </View>
            <Text style={[styles.nextTime, { color: tone }]}>{upcomingActionTimeText}</Text>
          </View>

          {!isDetailOpen ? (
            <View style={styles.tapHintRow}>
              <Ionicons name="arrow-up-circle-outline" size={16} color="#6F8F90" />
              <Text style={styles.tapHintText}>탭하여 상세 경로 확인하세요</Text>
            </View>
          ) : null}
        </Pressable>

        {isDetailOpen ? (
          <View style={styles.detailCard}>
            <Text style={styles.routeTitle}>이동 경로</Text>
            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              {detailLines.map((line, index) => (
                <View key={line.id} style={styles.timelineRow}>
                  <View style={styles.timelineAxis}>
                    {index < detailLines.length - 1 ? (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: index < currentDetailIndex ? tone : '#7ED9D1' },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.timelineDot,
                        index <= currentDetailIndex ? { backgroundColor: tone } : null,
                      ]}
                    >
                      <Ionicons
                        name={modeIcon(line.mode)}
                        size={14}
                        color={index <= currentDetailIndex ? '#FFFFFF' : '#58C7C2'}
                      />
                    </View>
                  </View>
                  <View
                    style={[
                      styles.detailRow,
                      index === currentDetailIndex ? styles.currentDetailRow : null,
                    ]}
                  >
                    <View style={styles.detailTextWrap}>
                      <Text style={styles.lineLabel}>{line.lineLabel}</Text>
                      <Text style={styles.stopName}>{line.stopName}</Text>
                    </View>
                    <Text
                      style={[
                        styles.etaText,
                        index === currentDetailIndex ? styles.currentEtaText : null,
                      ]}
                    >
                      {line.etaText}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>

      <View
        pointerEvents="none"
        style={[styles.homeTabBackground, { height: homeTabBarReserved + 24 }]}
      />
      <HomeTabBar status={homeTabStatus} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  map: { ...StyleSheet.absoluteFillObject, borderRadius: 0 },
  mapFallback: { backgroundColor: '#D8E3F8', alignItems: 'center', justifyContent: 'center' },
  mapDismissOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  mapFallbackText: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#35516F' },
  backButton: {
    position: 'absolute',
    top: 30,
    left: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  mapStatusPill: {
    position: 'absolute',
    top: 34,
    right: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  mapStatusText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 20,
    color: '#58C7C2',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
    overflow: 'hidden',
    zIndex: 1,
  },
  gradientLayerBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  gradientLayerTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    bottom: '58%',
  },
  dragHandleArea: { paddingBottom: 6, alignSelf: 'stretch' },
  grabber: {
    width: 39,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#8FD4CE',
    alignSelf: 'center',
  },
  summaryCard: {
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  hintPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  hintText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 13,
    lineHeight: 17,
  },
  remainingTimeWrap: { alignItems: 'flex-end' },
  remainingTimeValue: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 56,
    lineHeight: 58,
  },
  mainAction: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 26,
    lineHeight: 32,
    color: '#0D2B2A',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  support: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#5E787A',
  },
  nextCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 80,
    marginTop: 6,
    backgroundColor: '#F3F9FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  nextTextWrap: { flex: 1, gap: 2 },
  nextTitle: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 20,
    lineHeight: 20,
    color: '#123032',
  },
  nextSubtitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    lineHeight: 16,
    color: '#5E787A',
  },
  nextTime: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 34,
    lineHeight: 38,
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
  },
  tapHintText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    lineHeight: 16,
    color: '#6F8F90',
  },
  detailCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingTop: 4,
  },
  routeTitle: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    color: '#6F8F90',
    marginBottom: 8,
  },
  detailScroll: { flexGrow: 0 },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    marginBottom: 10,
  },
  timelineAxis: {
    width: 38,
    alignItems: 'center',
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: 22,
    bottom: -10,
    width: 2,
    backgroundColor: '#7ED9D1',
  },
  timelineDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTimelineDot: { backgroundColor: '#58C7C2' },
  detailRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  currentDetailRow: { backgroundColor: '#BFE9E6' },
  homeTabBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  detailTextWrap: { flex: 1 },
  lineLabel: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    color: '#102E30',
  },
  stopName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 13,
    lineHeight: 17,
    color: '#6F8F90',
  },
  etaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 34,
    lineHeight: 38,
    color: '#58C7C2',
  },
  currentEtaText: { color: '#1D5558' },
});
