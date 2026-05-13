import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteSegment, SelectedRouteSummary } from '../../route-recommend/model/selectedRoute';
import type { RouteDetailStep } from '../hooks/useRouteDetailState';

export interface RouteDetailViewProps {
  route: SelectedRouteSummary | null;
  lineLabel: string;
  steps: RouteDetailStep[];
  originAddress: string;
  destinationLabel: string;
  onPressBack: () => void;
  onPressStart: () => void;
  onPressRefresh: () => void;
}

const BUS_SEGMENT_COLOR = '#1F6E43';

type TimelineItem =
  | { kind: 'origin'; id: string; text: string }
  | { kind: 'walk'; id: string; text: string }
  | {
      kind: 'bus';
      id: string;
      start: string;
      end: string;
      durationText: string;
      candidates: RouteSegment[];
      stops: string[];
    }
  | {
      kind: 'subway';
      id: string;
      start: string;
      end: string;
      line: string;
      lineNumber: string;
      lineColor: string;
      durationText: string;
      direction?: string;
      transferTip?: string;
      stations: string[];
      candidates: RouteSegment[];
    }
  | { kind: 'destination'; id: string; text: string };

function withStationSuffix(name?: string) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return '-';
  }
  return trimmed.endsWith('역') ? trimmed : `${trimmed}역`;
}

function getSubwayLineNumber(line: string) {
  const compact = line.replace(/\s+/g, '');
  const matched = compact.match(/(\d{1,2})호선/);
  if (matched?.[1]) {
    return matched[1];
  }
  const numberOnly = compact.match(/(\d{1,2})/);
  return numberOnly?.[1] ?? '';
}

function getSubwayLineColor(line: string) {
  const n = getSubwayLineNumber(line);
  const colorMap: Record<string, string> = {
    '1': '#1D4ED8',
    '2': '#16A34A',
    '3': '#F97316',
    '4': '#06B6D4',
    '5': '#7C3AED',
    '6': '#A855F7',
    '7': '#6B7280',
    '8': '#EC4899',
    '9': '#C084FC',
  };
  return colorMap[n] ?? '#7C3AED';
}

function normalizeSubwayLineLabel(line: string) {
  const trimmed = line.replace(/수도권|전철/g, '').trim();
  const matched = trimmed.match(/(\d{1,2})\s*호선/);
  if (matched?.[1]) {
    return `${matched[1]}호선`;
  }
  return trimmed;
}

function isLikelyValidBusRouteLabel(lineLabel?: string): boolean {
  const raw = (lineLabel ?? '').trim();
  if (!raw) {
    return false;
  }
  // Internal ids like 1234567 should never be shown as route labels.
  if (/^\d{6,}$/.test(raw)) {
    return false;
  }
  return /[0-9A-Za-z가-힣]/.test(raw);
}

function toWalkText(segment: RouteSegment) {
  const minutes = Math.max(1, segment.durationMinutes);
  const meters = typeof segment.distanceMeters === 'number' && Number.isFinite(segment.distanceMeters)
    ? Math.round(segment.distanceMeters)
    : null;
  return meters ? `도보 ${meters}m (${minutes}분)` : `도보 (${minutes}분)`;
}

function liveSeconds(segment: RouteSegment, nowMs: number) {
  const base = typeof segment.realtimeEtaSeconds === 'number'
    ? segment.realtimeEtaSeconds
    : typeof segment.realtimeEtaMinutes === 'number'
      ? Math.round(segment.realtimeEtaMinutes * 60)
      : null;
  if (base === null) {
    return null;
  }
  const updatedAtMs = segment.realtimeUpdatedAt ? new Date(segment.realtimeUpdatedAt).getTime() : Number.NaN;
  if (Number.isNaN(updatedAtMs)) {
    return Math.max(0, base);
  }
  const elapsed = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  return Math.max(0, base - elapsed);
}

function toEtaText(segment: RouteSegment, nowMs: number) {
  const sec = liveSeconds(segment, nowMs);
  if (sec === null) {
    return '확인중';
  }
  if (sec <= 0) {
    return '곧 도착';
  }
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}분 ${ss}초`;
}

function etaSortValue(segment: RouteSegment): number {
  if (typeof segment.realtimeEtaSeconds === 'number' && Number.isFinite(segment.realtimeEtaSeconds)) {
    return Math.max(0, Math.round(segment.realtimeEtaSeconds));
  }
  if (typeof segment.realtimeEtaMinutes === 'number' && Number.isFinite(segment.realtimeEtaMinutes)) {
    return Math.max(0, Math.round(segment.realtimeEtaMinutes * 60));
  }
  return Number.POSITIVE_INFINITY;
}

function normalizeDirectionToken(value: string): string {
  return value.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '').toLowerCase();
}

function normalizeStationToken(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/역$/g, '')
    .replace(/[^\w가-힣]/g, '')
    .toLowerCase();
}

function extractDirectionToken(raw: string): string | undefined {
  const normalized = normalizeDirectionToken(raw);
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes('상행')) {
    return '상행';
  }
  if (normalized.includes('하행')) {
    return '하행';
  }
  if (normalized.includes('내선')) {
    return '내선';
  }
  if (normalized.includes('외선')) {
    return '외선';
  }
  return undefined;
}

function extractBoundLabel(raw: string): string | undefined {
  const compact = (raw ?? '').replace(/\s+/g, '');
  const matches = compact.match(/([가-힣A-Za-z0-9]+)행/);
  const bound = matches?.[1]?.trim();
  if (!bound) {
    return undefined;
  }
  // 상행/하행/내선/외선은 방면명이 아니라 방향 토큰으로 취급한다.
  if (extractDirectionToken(bound)) {
    return undefined;
  }
  return bound;
}

interface SubwayDirectionInfo {
  boundToken?: string;
  boundLabel?: string;
  directionToken?: string;
}

function extractSubwayDirectionInfo(segment: RouteSegment, fallbackDirection?: string): SubwayDirectionInfo {
  const lineBound = extractBoundLabel(segment.lineLabel ?? '');
  const directionBound = extractBoundLabel(segment.directionLabel ?? fallbackDirection ?? '');
  const boundLabel = lineBound ?? directionBound;
  const directionToken =
    extractDirectionToken(segment.directionLabel ?? '') ??
    extractDirectionToken(segment.lineLabel ?? '') ??
    extractDirectionToken(fallbackDirection ?? '');

  return {
    boundToken: boundLabel ? normalizeStationToken(boundLabel) : undefined,
    boundLabel,
    directionToken,
  };
}

interface SubwayDirectionTarget {
  kind: 'bound' | 'direction';
  token: string;
  label: string;
}

function resolveSubwayDirectionTarget(
  candidates: RouteSegment[],
  preferredDirection?: string,
  endStationName?: string,
): SubwayDirectionTarget | null {
  const preferred = extractSubwayDirectionInfo({ mode: 'subway', durationMinutes: 0, directionLabel: preferredDirection });
  if (preferred.boundToken && preferred.boundLabel) {
    return { kind: 'bound', token: preferred.boundToken, label: `${preferred.boundLabel}행` };
  }
  if (preferred.directionToken) {
    return { kind: 'direction', token: preferred.directionToken, label: preferred.directionToken };
  }

  const normalizedEnd = normalizeStationToken(endStationName ?? '');
  const sorted = [...candidates].sort((a, b) => etaSortValue(a) - etaSortValue(b));
  if (normalizedEnd) {
    const endMatched = sorted.find((candidate) => {
      const info = extractSubwayDirectionInfo(candidate);
      if (!info.boundToken) {
        return false;
      }
      return info.boundToken.includes(normalizedEnd) || normalizedEnd.includes(info.boundToken);
    });
    if (endMatched) {
      const info = extractSubwayDirectionInfo(endMatched);
      if (info.boundToken && info.boundLabel) {
        return { kind: 'bound', token: info.boundToken, label: `${info.boundLabel}행` };
      }
    }
  }

  for (const candidate of sorted) {
    const info = extractSubwayDirectionInfo(candidate);
    if (info.boundToken && info.boundLabel) {
      return { kind: 'bound', token: info.boundToken, label: `${info.boundLabel}행` };
    }
    if (info.directionToken) {
      return { kind: 'direction', token: info.directionToken, label: info.directionToken };
    }
  }

  return null;
}

function matchesSubwayDirectionTarget(candidate: RouteSegment, target: SubwayDirectionTarget): boolean {
  const info = extractSubwayDirectionInfo(candidate);
  if (target.kind === 'bound') {
    if (!info.boundToken) {
      return false;
    }
    return info.boundToken.includes(target.token) || target.token.includes(info.boundToken);
  }
  if (!info.directionToken) {
    return false;
  }
  return info.directionToken === target.token;
}

function pickSubwayDisplayCandidates(
  candidates: RouteSegment[],
  target: SubwayDirectionTarget | null,
): RouteSegment[] {
  const sorted = [...candidates].sort((a, b) => etaSortValue(a) - etaSortValue(b));
  const filtered = target ? sorted.filter((candidate) => matchesSubwayDirectionTarget(candidate, target)) : sorted;
  const effective = filtered.length > 0 ? filtered : sorted;
  return effective.slice(0, 3);
}

function hasSubwayDirectionInfo(segment: RouteSegment, fallbackDirection?: string): boolean {
  const info = extractSubwayDirectionInfo(segment, fallbackDirection);
  return Boolean(info.boundLabel || info.directionToken);
}

function resolveSubwayBoundText(segment: RouteSegment, fallbackDirection?: string) {
  const info = extractSubwayDirectionInfo(segment, fallbackDirection);
  if (info.boundLabel) {
    return `${info.boundLabel}행`;
  }
  if (info.directionToken) {
    return info.directionToken;
  }
  return '방면 정보';
}

function toVirtualSegmentCandidate(
  base: RouteSegment,
  candidate: NonNullable<RouteSegment['candidates']>[number],
): RouteSegment {
  return {
    ...base,
    lineLabel: candidate.route || base.lineLabel,
    directionLabel: candidate.direction ?? base.directionLabel,
    realtimeEtaMinutes: candidate.etaMinutes,
    realtimeEtaSeconds: candidate.etaSeconds ?? (Number.isFinite(candidate.etaMinutes) ? Math.round(candidate.etaMinutes * 60) : undefined),
    realtimeUpdatedAt: base.realtimeUpdatedAt,
  };
}

function buildItems(
  route: SelectedRouteSummary | null,
  originAddress: string,
  destinationLabel: string,
): TimelineItem[] {
  if (!route) {
    return [];
  }

  const items: TimelineItem[] = [];
  items.push({ kind: 'origin', id: 'origin', text: originAddress || route.segments[0]?.startName || '출발지' });

  const displayedBusKeys = new Set<string>();
  const displayedSubwayKeys = new Set<string>();
  const uniq = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  const normalize = (value: string) => value.replace(/\s+/g, '').trim();

  route.segments.forEach((segment, index) => {
    if (segment.mode === 'walk') {
      items.push({ kind: 'walk', id: `walk-${index}`, text: toWalkText(segment) });
      return;
    }

    if (segment.mode === 'bus') {
      const start = segment.startName ?? '-';
      const end = segment.endName ?? '-';
      const key = `${start}::${end}`;
      if (displayedBusKeys.has(key)) {
        return;
      }
      displayedBusKeys.add(key);

      const grouped = route.segments
        .filter((candidate) => candidate.mode === 'bus')
        .filter((candidate) => (candidate.startName ?? '-') === start && (candidate.endName ?? '-') === end)
        .sort((a, b) => {
          const aEta = a.realtimeEtaSeconds ?? Math.round((a.realtimeEtaMinutes ?? 999) * 60);
          const bEta = b.realtimeEtaSeconds ?? Math.round((b.realtimeEtaMinutes ?? 999) * 60);
          return aEta - bEta;
        });
      const groupedFromCandidates = grouped
        .flatMap((candidate) =>
          (candidate.candidates ?? []).map((candidateItem) => toVirtualSegmentCandidate(candidate, candidateItem)),
        )
        .filter((candidate) => isLikelyValidBusRouteLabel(candidate.lineLabel))
        .sort((a, b) => {
          const aEta = a.realtimeEtaSeconds ?? Math.round((a.realtimeEtaMinutes ?? 999) * 60);
          const bEta = b.realtimeEtaSeconds ?? Math.round((b.realtimeEtaMinutes ?? 999) * 60);
          return aEta - bEta;
        });
      const keyOf = (seg: RouteSegment) => (seg.lineLabel ?? '').trim().replace(/\s+/g, '').toLowerCase();
      const etaOf = (seg: RouteSegment) =>
        seg.realtimeEtaSeconds ?? Math.round((seg.realtimeEtaMinutes ?? 999) * 60);
      const fromRouteMap = new Map(grouped.map((seg) => [keyOf(seg), seg] as const));
      const mergedCandidates = [...grouped];
      groupedFromCandidates.forEach((seg) => {
        const key = keyOf(seg);
        if (!fromRouteMap.has(key)) {
          mergedCandidates.push(seg);
        }
      });
      const uniqueRouteKeys = Array.from(new Set(mergedCandidates.map((candidate) => keyOf(candidate))));
      const effectiveGrouped =
        uniqueRouteKeys.length === 1
          ? [...grouped, ...groupedFromCandidates]
              .filter((candidate) => keyOf(candidate) === uniqueRouteKeys[0])
              .sort((a, b) => etaOf(a) - etaOf(b))
              .filter((candidate, idx, arr) => {
                if (idx === 0) {
                  return true;
                }
                const prevEta = etaOf(arr[idx - 1]);
                const currEta = etaOf(candidate);
                // 동일 차량으로 보이는 거의 동일 ETA는 제거
                return Math.abs(currEta - prevEta) >= 30;
              })
              .slice(0, 2)
          : mergedCandidates;

      const mergedStopsFromGroup = grouped.flatMap((candidate) => candidate.passStops ?? []);
      const mergedStopsFromCandidates = effectiveGrouped.flatMap((candidate) => candidate.passStops ?? []);
      const mergedStops = uniq([...mergedStopsFromGroup, ...mergedStopsFromCandidates]).filter((name) => {
        const normalized = normalize(name);
        return normalized !== normalize(start) && normalized !== normalize(end);
      });

      items.push({
        kind: 'bus',
        id: `bus-${key}`,
        start,
        end,
        durationText: `${Math.max(1, segment.durationMinutes)}분`,
        candidates: effectiveGrouped,
        stops: mergedStops,
      });
      return;
    }

    const start = withStationSuffix(segment.startName);
    const end = withStationSuffix(segment.endName);
    const lineLabel = normalizeSubwayLineLabel(segment.lineLabel?.trim() ?? '지하철');
    const subwayKey = `${start}::${end}::${lineLabel}`;
    if (displayedSubwayKeys.has(subwayKey)) {
      return;
    }
    displayedSubwayKeys.add(subwayKey);

    const grouped = route.segments
      .filter((candidate) => candidate.mode === 'subway')
      .filter(
        (candidate) =>
          withStationSuffix(candidate.startName) === start &&
          withStationSuffix(candidate.endName) === end &&
          normalizeSubwayLineLabel(candidate.lineLabel?.trim() ?? '지하철') === lineLabel,
      )
      .sort((a, b) => {
        const aEta = a.realtimeEtaSeconds ?? Math.round((a.realtimeEtaMinutes ?? 999) * 60);
        const bEta = b.realtimeEtaSeconds ?? Math.round((b.realtimeEtaMinutes ?? 999) * 60);
        return aEta - bEta;
      });
    const groupedFromCandidates = grouped
      .flatMap((candidate) =>
        (candidate.candidates ?? []).map((candidateItem) => toVirtualSegmentCandidate(candidate, candidateItem)),
      )
      .sort((a, b) => {
        const aEta = a.realtimeEtaSeconds ?? Math.round((a.realtimeEtaMinutes ?? 999) * 60);
        const bEta = b.realtimeEtaSeconds ?? Math.round((b.realtimeEtaMinutes ?? 999) * 60);
        return aEta - bEta;
      });
    const keyOfLine = (seg: RouteSegment) =>
      normalizeSubwayLineLabel(seg.lineLabel?.trim() ?? lineLabel).replace(/\s+/g, '').toLowerCase();
    const keyOf = (seg: RouteSegment) => {
      const directionKey = normalizeDirectionToken(resolveSubwayBoundText(seg, segment.directionLabel));
      return `${keyOfLine(seg)}::${directionKey || 'unknown'}`;
    };
    const mergedCandidates = [...grouped];
    const mergedKeyIndex = new Map(mergedCandidates.map((seg, i) => [keyOf(seg), i] as const));
    groupedFromCandidates.forEach((seg) => {
      const key = keyOf(seg);
      const existingIdx = mergedKeyIndex.get(key);
      if (existingIdx === undefined) {
        mergedKeyIndex.set(key, mergedCandidates.length);
        mergedCandidates.push(seg);
        return;
      }
      // 같은 방면 후보면 더 빠른 ETA 또는 더 많은 방향정보를 가진 값을 우선한다.
      const existing = mergedCandidates[existingIdx];
      const existingEta = existing.realtimeEtaSeconds ?? Math.round((existing.realtimeEtaMinutes ?? 999) * 60);
      const nextEta = seg.realtimeEtaSeconds ?? Math.round((seg.realtimeEtaMinutes ?? 999) * 60);
      const existingHasDirection = hasSubwayDirectionInfo(existing, segment.directionLabel);
      const nextHasDirection = hasSubwayDirectionInfo(seg, segment.directionLabel);
      if ((nextHasDirection && !existingHasDirection) || nextEta < existingEta) {
        mergedCandidates[existingIdx] = seg;
      }
    });
    const directionalLineSet = new Set(
      mergedCandidates
        .filter((candidate) => hasSubwayDirectionInfo(candidate, segment.directionLabel))
        .map((candidate) => keyOfLine(candidate)),
    );
    const effectiveGrouped = mergedCandidates
      .filter((candidate) => {
        const lineKey = keyOfLine(candidate);
        if (!directionalLineSet.has(lineKey)) {
          return true;
        }
        return hasSubwayDirectionInfo(candidate, segment.directionLabel);
      })
      .sort((a, b) => {
        const aEta = a.realtimeEtaSeconds ?? Math.round((a.realtimeEtaMinutes ?? 999) * 60);
        const bEta = b.realtimeEtaSeconds ?? Math.round((b.realtimeEtaMinutes ?? 999) * 60);
        return aEta - bEta;
      });

    const mergedStationsFromGroup = grouped.flatMap((candidate) => candidate.passStops ?? []);
    const mergedStationsFromCandidates = effectiveGrouped.flatMap((candidate) => candidate.passStops ?? []);
    const mergedStations = uniq([...mergedStationsFromGroup, ...mergedStationsFromCandidates]).filter((name) => {
      const normalized = normalize(withStationSuffix(name));
      return normalized !== normalize(start) && normalized !== normalize(end);
    });

    items.push({
      kind: 'subway',
      id: `subway-${index}`,
      start,
      end,
      line: lineLabel,
      lineNumber: getSubwayLineNumber(segment.lineLabel?.trim() ?? '지하철'),
      lineColor: getSubwayLineColor(segment.lineLabel?.trim() ?? '지하철'),
      durationText: `${Math.max(1, segment.durationMinutes)}분`,
      direction: segment.directionLabel,
      transferTip: segment.transferTip,
      stations: mergedStations.map((name) => withStationSuffix(name)),
      candidates: effectiveGrouped.length > 0 ? effectiveGrouped : [segment],
    });
  });

  items.push({
    kind: 'destination',
    id: 'destination',
    text:
      destinationLabel ||
      route.segments[route.segments.length - 1]?.endName ||
      route.segments
        .slice()
        .reverse()
        .find((segment) => (segment.endName ?? '').trim().length > 0)
        ?.endName ||
      '도착지',
  });

  return items;
}

function Node({ item }: { item: TimelineItem }) {
  const kind = item.kind;
  if (kind === 'walk') {
    return <Ionicons name="walk-outline" size={17} color="#7B8794" style={styles.walkIcon} />;
  }
  if (kind === 'bus') {
    return <Ionicons name="bus-outline" size={17} color={BUS_SEGMENT_COLOR} />;
  }
  if (kind === 'subway') {
    return (
      <View style={[styles.subwayBadge, { borderColor: item.lineColor }]}>
        <Text style={[styles.subwayBadgeText, { color: item.lineColor }]}>{item.lineNumber}</Text>
      </View>
    );
  }
  if (kind === 'destination') {
    return <Ionicons name="ellipse" size={13} color="#58C7C2" />;
  }
  return <Ionicons name="ellipse" size={12} color="#7B8794" />;
}

function getAxisLineStyle(item: TimelineItem) {
  if (item.kind === 'bus') {
    return {
      backgroundColor: BUS_SEGMENT_COLOR,
      width: 12,
    } as const;
  }
  if (item.kind === 'subway') {
    return {
      backgroundColor: item.lineColor,
      width: 12,
    } as const;
  }
  return {
    backgroundColor: '#D7DFEA',
    width: 3,
  } as const;
}

export function RouteDetailView({
  route,
  originAddress,
  destinationLabel,
  onPressBack,
  onPressStart,
  onPressRefresh,
}: RouteDetailViewProps) {
  const insets = useSafeAreaInsets();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const items = useMemo(
    () => buildItems(route, originAddress, destinationLabel),
    [destinationLabel, originAddress, route],
  );
  const isClosingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 56 && !isClosingRef.current) {
            isClosingRef.current = true;
            onPressBack();
          }
        },
      }),
    [onPressBack],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable style={styles.backdrop} onPress={onPressBack} />
      <View style={styles.sheet} {...panResponder.panHandlers}>
        <View style={styles.header}>
          <Pressable onPress={onPressBack} style={styles.headerIconBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {route ? `${route.departure} → ${route.arrival}` : '경로 상세'}
          </Text>
          <View style={styles.headerIconBtn} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 106 }]}>
        <View style={styles.timelineWrap}>
        <View pointerEvents="none" style={styles.timelineBaseLine} />
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const segmentColor =
            item.kind === 'bus' ? BUS_SEGMENT_COLOR : item.kind === 'subway' ? item.lineColor : null;
          return (
            <View
              key={item.id}
              style={[styles.row, item.kind === 'walk' ? styles.rowWalk : null]}
            >
              <View style={[styles.axisCol, item.kind === 'walk' ? styles.axisColWalk : null]}>
                <View style={[styles.nodeWrap, item.kind === 'walk' ? styles.nodeWrapWalk : null]}>
                  <Node item={item} />
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.axisLine,
                      segmentColor ? styles.axisLineFromCenter : null,
                      item.kind === 'bus' || item.kind === 'subway'
                        ? getAxisLineStyle(item)
                        : styles.axisLineTransparent,
                    ]}
                  />
                ) : null}
                {segmentColor ? (
                  <View style={[styles.segmentEndNode, { borderColor: segmentColor }]} />
                ) : null}
              </View>

              <View
                style={
                  item.kind === 'walk'
                    ? styles.walkTextWrap
                    : item.kind === 'origin' || item.kind === 'destination'
                      ? styles.anchorStrip
                      : styles.segmentContentWrap
                }
              >
                {item.kind === 'origin' ? <Text style={styles.originText}>{item.text}</Text> : null}
                {item.kind === 'destination' ? <Text style={styles.destinationText}>{item.text}</Text> : null}
                {item.kind === 'walk' ? <Text style={styles.walkText}>{item.text}</Text> : null}

                {item.kind === 'bus' ? (
                  <>
                    {(() => {
                      const normalizedRoute = (value?: string) =>
                        (value ?? '').replace(/\s+/g, '').toLowerCase();
                      const etaOf = (segment: RouteSegment) =>
                        segment.realtimeEtaSeconds ?? Math.round((segment.realtimeEtaMinutes ?? 999) * 60);
                      const routeKeys = Array.from(
                        new Set(item.candidates.map((candidate) => normalizedRoute(candidate.lineLabel))),
                      ).filter(Boolean);
                      const isSingleRoute = routeKeys.length === 1;
                      const displayCandidates = isSingleRoute
                        ? [...item.candidates]
                            .filter((candidate) => normalizedRoute(candidate.lineLabel) === routeKeys[0])
                            .sort((a, b) => etaOf(a) - etaOf(b))
                            .slice(0, 2)
                        : item.candidates;
                      const nextCount = isSingleRoute ? Math.max(0, displayCandidates.length - 1) : 0;
                      return (
                        <>
                    <Text style={styles.segmentStartText}>{item.start}</Text>
                    <Text style={styles.segmentModeText}>{`버스 · ${item.durationText}`}</Text>
                    <View style={styles.block}>
                      <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>
                          {isSingleRoute
                            ? nextCount > 0
                              ? `같은 경로 버스 1대 · 다음차 ${nextCount}대`
                              : '같은 경로 버스 1대'
                            : `같은 경로 버스 ${routeKeys.length}대`}
                        </Text>
                        {displayCandidates.map((candidate, i) => (
                          <View key={`${item.id}-${candidate.lineLabel ?? 'bus'}-${i}`} style={styles.rowBetween}>
                            <Text style={styles.candidateLine}>{candidate.lineLabel ?? '버스'}</Text>
                            <Text style={styles.candidateEta}>
                              {(() => {
                                const currentRoute = normalizedRoute(candidate.lineLabel);
                                const prevSameRoute = displayCandidates
                                  .slice(0, i)
                                  .reverse()
                                  .find(
                                    (prev) => normalizedRoute(prev.lineLabel) === currentRoute,
                                  );
                                if (!prevSameRoute) {
                                  return toEtaText(candidate, nowMs);
                                }
                                const currentSec = liveSeconds(candidate, nowMs);
                                const prevSec = liveSeconds(prevSameRoute, nowMs);
                                if (
                                  typeof currentSec !== 'number' ||
                                  typeof prevSec !== 'number' ||
                                  currentSec <= prevSec
                                ) {
                                  return toEtaText(candidate, nowMs);
                                }
                                const gapMin = Math.max(1, Math.round((currentSec - prevSec) / 60));
                                return `${toEtaText(candidate, nowMs)} (+${gapMin}분)`;
                              })()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                        </>
                      );
                    })()}
                    {item.stops.length > 0 ? (
                      <>
                        <Pressable
                          onPress={() => setCollapsed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          style={styles.toggleBtn}
                        >
                          <Text style={styles.toggleText}>{`${item.stops.length}개 정류장 · ${item.durationText}`}</Text>
                          <Ionicons name={collapsed[item.id] ? 'chevron-down' : 'chevron-up'} size={18} color="#1F2A37" />
                        </Pressable>
                        {!collapsed[item.id] ? (
                          <View style={styles.stopList}>
                            {item.stops.map((stop) => (
                              <View key={stop} style={styles.stopRow}>
                                <View style={styles.stopDot} />
                                <Text style={styles.stopText}>{stop}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    <Text style={styles.segmentEndText}>{item.end}</Text>
                  </>
                ) : null}

                {item.kind === 'subway' ? (
                  <>
                    {(() => {
                      const directionTarget = resolveSubwayDirectionTarget(
                        item.candidates,
                        item.direction,
                        item.end,
                      );
                      const candidates = pickSubwayDisplayCandidates(item.candidates, directionTarget);
                      const directionTitle = directionTarget?.label ?? '방면 정보';
                      return (
                        <>
                    <Text style={styles.segmentStartText}>{`${item.start} ${item.line}`}</Text>
                    {item.transferTip ? <Text style={styles.transferTip}>{item.transferTip}</Text> : null}
                    <View style={styles.block}>
                      <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>{`${directionTitle} · 시간순`}</Text>
                        {item.transferTip ? <Text style={styles.infoSubTitle}>{`빠른 환승 ${item.transferTip.replace(/^빠른\s*/, '')}`}</Text> : null}
                        {candidates.map((candidate, i) => (
                          <View key={`${item.id}-subway-${candidate.lineLabel ?? 'subway'}-${i}`} style={styles.rowBetween}>
                            <Text style={styles.candidateLine}>
                              {`${normalizeSubwayLineLabel(candidate.lineLabel?.trim() ?? item.line)} · ${resolveSubwayBoundText(candidate, directionTitle)}`}
                            </Text>
                            <Text style={styles.candidateEta}>{toEtaText(candidate, nowMs)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                        </>
                      );
                    })()}
                    {item.stations.length > 0 ? (
                      <>
                        <Pressable
                          onPress={() => setCollapsed((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                          style={styles.toggleBtn}
                        >
                          <Text style={styles.toggleText}>{`${item.stations.length}개 역 · ${item.durationText}`}</Text>
                          <Ionicons name={collapsed[item.id] ? 'chevron-down' : 'chevron-up'} size={18} color="#1F2A37" />
                        </Pressable>
                        {!collapsed[item.id] ? (
                          <View style={styles.stopList}>
                            {item.stations.map((station) => (
                              <View key={station} style={styles.stopRow}>
                                <View style={styles.stopDot} />
                                <Text style={styles.stopText}>{station}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </>
                    ) : null}
                    <Text style={styles.segmentEndText}>{item.end}</Text>
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
        </View>
        </ScrollView>

        <View style={[styles.bottomCta, { paddingBottom: Math.max(14, insets.bottom + 4) }]}>
          <Pressable onPress={onPressStart} style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>선택하기</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onPressRefresh}
          style={[
            styles.floatingRefreshButton,
            { bottom: Math.max(86, insets.bottom + 76) },
          ]}
        >
          <Ionicons name="refresh" size={24} color="#2F63D8" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 20, 40, 0.26)',
  },
  sheet: {
    flex: 1,
    marginRight: 18,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  header: {
    height: 76,
    backgroundColor: '#5A8FF0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  content: { paddingHorizontal: 14, paddingTop: 12, backgroundColor: '#FFFFFF' },
  timelineWrap: {
    position: 'relative',
  },
  timelineBaseLine: {
    position: 'absolute',
    left: 16,
    top: 24,
    bottom: 24,
    width: 3,
    backgroundColor: '#D7DFEA',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 6 },
  rowWalk: { alignItems: 'flex-start', paddingBottom: 16 },
  axisCol: { width: 34, alignItems: 'center' },
  axisColWalk: { width: 34 },
  nodeWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D8E6F6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    zIndex: 5,
  },
  nodeWrapWalk: {
    marginTop: 14,
  },
  axisLine: { width: 3, flex: 1, backgroundColor: '#D7DFEA', marginTop: 0, zIndex: 1 },
  axisLineFromCenter: { marginTop: -10, marginBottom: 14 },
  axisLineTransparent: {
    width: 3,
    flex: 1,
    backgroundColor: 'transparent',
    marginTop: 0,
    zIndex: 1,
  },
  segmentEndNode: {
    position: 'absolute',
    left: 8,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    zIndex: 4,
  },
  subwayBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  subwayBadgeText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 14,
    lineHeight: 16,
  },
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  segmentContentWrap: {
    flex: 1,
    marginBottom: 0,
    paddingTop: 10,
    paddingLeft: 4,
    gap: 6,
  },
  segmentStartText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    lineHeight: 28,
    color: '#152238',
  },
  segmentModeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#5A6777',
  },
  segmentEndText: {
    paddingTop: 10,
    fontFamily: 'Pretendard-Bold',
    fontSize: 21,
    lineHeight: 27,
    color: '#111827',
  },
  anchorStrip: {
    flex: 1,
    marginBottom: 0,
    minHeight: 48,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  walkTextWrap: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingLeft: 4,
    marginBottom: 0,
  },
  originText: { fontFamily: 'Pretendard-Bold', fontSize: 21, lineHeight: 28, color: '#111827' },
  destinationText: { fontFamily: 'Pretendard-Bold', fontSize: 21, lineHeight: 28, color: '#111827' },
  walkText: { fontFamily: 'Pretendard-Medium', fontSize: 17, lineHeight: 22, color: '#5B6775' },
  walkIcon: { marginTop: 0 },
  transferTip: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, lineHeight: 20, color: '#7A8797' },
  infoCard: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 12,
    backgroundColor: '#F9FBFF',
    padding: 12,
    gap: 6,
  },
  infoTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 17, lineHeight: 23, color: '#233247' },
  infoSubTitle: { fontFamily: 'Pretendard-Medium', fontSize: 14, lineHeight: 19, color: '#6B7686' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  candidateLine: { fontFamily: 'Pretendard-Medium', fontSize: 16, lineHeight: 21, color: '#445266' },
  candidateEta: { fontFamily: 'Pretendard-Bold', fontSize: 18, lineHeight: 24, color: '#D64545' },
  subwayDuration: { fontFamily: 'Pretendard-Bold', fontSize: 20, lineHeight: 26, color: '#D64545' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  toggleText: { fontFamily: 'Pretendard-Bold', fontSize: 17, lineHeight: 23, color: '#1F2A37' },
  stopList: { gap: 8, paddingLeft: 2, paddingTop: 2, paddingBottom: 2 },
  stopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 28, position: 'relative' },
  stopDot: {
    position: 'absolute',
    left: -27,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D9E2EC',
    top: 10,
    zIndex: 20,
    elevation: 20,
  },
  stopText: { fontFamily: 'Pretendard-Medium', fontSize: 16, lineHeight: 21, color: '#111827', flex: 1 },
  bottomCta: { position: 'absolute', left: 14, right: 14, bottom: 0 },
  floatingRefreshButton: {
    position: 'absolute',
    right: 16,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D2B2A',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E6ECF2',
  },
  selectBtn: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#58C7C2',
    shadowColor: '#0D2B2A',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  selectBtnText: { fontFamily: 'Pretendard-Bold', fontSize: 20, lineHeight: 26, color: '#FFFFFF' },
});
