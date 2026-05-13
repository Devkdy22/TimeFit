import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import BestIcon from '../../../../assets/icons/best.png';
import { HomeTabBar } from '../../../components/home';
import { TimiSvg } from '../../../components/timi';
import type { UiStatus } from '../../../theme/status-config';
import { getTransitLineStyle } from '../model/transitLineStyle';
import type { SelectedRouteSummary as RouteCardItem } from '../model/selectedRoute';

export interface RouteRecommendViewProps {
  phase: 'loading' | 'ready' | 'error';
  status: UiStatus;
  statusLabel: string;
  subtitle: string;
  headerDestination: string;
  headerArrivalAt: string;
  recommended: RouteCardItem;
  alternatives: RouteCardItem[];
  errorMessage: string | null;
  source: 'api';
  onRetry: () => void;
  onPressDetail: (route: RouteCardItem) => void;
  onPressSelect: (route: RouteCardItem) => void;
  onClose: () => void;
}

const BEST_ICON = BestIcon;

function RouteStatusPill({ label }: { label: string }) {
  const isWarning = label === '주의';
  const isDanger = label === '긴급' || label === '위험';
  const pillStyle = isDanger
    ? styles.statusDangerPill
    : isWarning
      ? styles.statusWarningPill
      : styles.statusRelaxedPill;
  const textStyle = isDanger
    ? styles.statusDangerText
    : isWarning
      ? styles.statusWarningText
      : styles.statusRelaxedText;

  return (
    <View style={[styles.statusPill, pillStyle]}>
      <Text allowFontScaling={false} style={[styles.statusPillText, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

function RouteTimingRow({
  departure,
  arrival,
  totalFareText,
}: Pick<RouteCardItem, 'departure' | 'arrival' | 'totalFareText'>) {
  return (
    <View style={styles.timingWrap}>
      <Text allowFontScaling={false} style={styles.timingMetaText}>
        {departure} 출발 → {arrival} 도착 · {totalFareText}
      </Text>
    </View>
  );
}

function RouteSummaryBadges({ item }: { item: RouteCardItem }) {
  const tokens = item.transportSummary
    .split('·')
    .map((token) => token.trim())
    .filter(Boolean);

  const badges = [
    tokens.find((token) => token.includes('환승')),
    tokens.find((token) => token.includes('도보')),
    tokens.find((token) => /원|₩/.test(token)),
  ].filter((token): token is string => Boolean(token));

  if (badges.length === 0) {
    return null;
  }

  return (
    <View style={styles.summaryBadgeRow}>
      {badges.map((badge) => (
        <View key={badge} style={styles.summaryBadge}>
          <Text allowFontScaling={false} style={styles.summaryBadgeText}>
            {badge}
          </Text>
        </View>
      ))}
    </View>
  );
}

function isWalkOnlyRoute(segments: RouteCardItem['segments']) {
  return segments.length > 0 && segments.every((segment) => segment.mode === 'walk');
}

function resolveSegmentVisual(segment: RouteCardItem['segments'][number]) {
  if (segment.mode === 'walk') {
    return {
      backgroundColor: '#ECEFF3',
      textColor: '#6B7280',
      icon: 'walk' as const,
      label: '도보',
      detailLabel: '도보',
    };
  }
  if (segment.mode === 'bus') {
    const style = getTransitLineStyle({
      mode: 'bus',
      lineName: segment.lineLabel,
      routeNo: segment.lineLabel,
    });
    return {
      backgroundColor: style.color,
      textColor: style.textColor,
      icon: 'bus-outline' as const,
      label: segment.lineLabel?.trim() || style.label,
      detailLabel: segment.lineLabel?.trim() || '버스',
    };
  }
  if (segment.mode === 'subway') {
    const style = getTransitLineStyle({
      mode: 'subway',
      lineName: segment.lineLabel,
    });
    const lineOnly = (style.label.match(/(\d{1,2}\s*호선)/)?.[1] ?? style.label).replace(/\s+/g, '');
    return {
      backgroundColor: style.color,
      textColor: style.textColor,
      icon: 'train-outline' as const,
      label: lineOnly,
      detailLabel: lineOnly,
    };
  }
  return {
    backgroundColor: '#ECEFF3',
    textColor: '#6B7280',
    icon: 'walk' as const,
    label: '도보',
    detailLabel: '도보',
  };
}

function toLiveRemainingSeconds(segment: RouteCardItem['segments'][number], nowMs: number) {
  const candidateSeconds = segment.candidates
    ?.map((candidate) => {
      if (typeof candidate.etaSeconds === 'number' && Number.isFinite(candidate.etaSeconds)) {
        return Math.round(candidate.etaSeconds);
      }
      if (typeof candidate.etaMinutes === 'number' && Number.isFinite(candidate.etaMinutes)) {
        return Math.round(candidate.etaMinutes * 60);
      }
      return null;
    })
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b)[0];

  const baseSeconds =
    typeof segment.realtimeEtaSeconds === 'number'
      ? segment.realtimeEtaSeconds
      : typeof segment.realtimeEtaMinutes === 'number'
        ? Math.round(segment.realtimeEtaMinutes * 60)
        : (candidateSeconds ?? null);
  if (baseSeconds === null) {
    return null;
  }
  const updatedAtMs = segment.realtimeUpdatedAt ? new Date(segment.realtimeUpdatedAt).getTime() : Number.NaN;
  if (Number.isNaN(updatedAtMs)) {
    return Math.max(0, Math.round(baseSeconds));
  }
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  return Math.max(0, Math.round(baseSeconds) - elapsedSeconds);
}

function toRealtimeLegendText(segment: RouteCardItem['segments'][number], nowMs: number) {
  if (segment.mode === 'walk') {
    return null;
  }

  const liveSeconds = toLiveRemainingSeconds(segment, nowMs);
  if (typeof liveSeconds === 'number') {
    if (liveSeconds <= 0) {
      return '곧 도착';
    }
    const minutes = Math.floor(liveSeconds / 60);
    const seconds = liveSeconds % 60;
    if (segment.realtimeStatus === 'STALE') {
      return `최근 정보 기준 ${minutes}분 ${seconds}초 후`;
    }
    if (segment.realtimeStatus === 'DELAYED') {
      return `${minutes}분 ${seconds}초 후 (지연)`;
    }
    return `${minutes}분 ${seconds}초 후`;
  }

  if (segment.realtimeStatus === 'UNAVAILABLE') {
    return '도착 정보 없음';
  }
  return '실시간 확인중';
}

function formatEtaText(segment: RouteCardItem['segments'][number], nowMs: number) {
  const liveSeconds = toLiveRemainingSeconds(segment, nowMs);
  if (typeof liveSeconds === 'number') {
    if (liveSeconds <= 0) {
      return '곧 도착';
    }
    const minutes = Math.floor(liveSeconds / 60);
    const seconds = liveSeconds % 60;
    return `${minutes}분 ${seconds}초 후`;
  }
  if (segment.realtimeStatus === 'UNAVAILABLE') {
    return '정보 없음';
  }
  return '확인중';
}

function buildGroupedBusByStopPair(segments: RouteCardItem['segments']) {
  const buses = segments.filter((segment) => segment.mode === 'bus');
  const map = new Map<
    string,
    {
      key: string;
      startName?: string;
      endName?: string;
      durationMinutes: number;
      items: RouteCardItem['segments'];
    }
  >();

  buses.forEach((segment) => {
    const key = `${segment.startName?.trim() ?? ''}::${segment.endName?.trim() ?? ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(segment);
      existing.durationMinutes = Math.max(existing.durationMinutes, segment.durationMinutes);
      return;
    }
    map.set(key, {
      key,
      startName: segment.startName,
      endName: segment.endName,
      durationMinutes: segment.durationMinutes,
      items: [segment],
    });
  });

  return Array.from(map.values()).map((group) => {
    const getEffectiveEtaSeconds = (segment: RouteCardItem['segments'][number]) => {
      if (typeof segment.realtimeEtaSeconds === 'number' && Number.isFinite(segment.realtimeEtaSeconds)) {
        return Math.max(0, Math.round(segment.realtimeEtaSeconds));
      }
      if (typeof segment.realtimeEtaMinutes === 'number' && Number.isFinite(segment.realtimeEtaMinutes)) {
        return Math.max(0, Math.round(segment.realtimeEtaMinutes * 60));
      }
      const candidateMin = segment.candidates
        ?.map((candidate) => {
          if (typeof candidate.etaSeconds === 'number' && Number.isFinite(candidate.etaSeconds)) {
            return Math.max(0, Math.round(candidate.etaSeconds));
          }
          if (typeof candidate.etaMinutes === 'number' && Number.isFinite(candidate.etaMinutes)) {
            return Math.max(0, Math.round(candidate.etaMinutes * 60));
          }
          return Number.POSITIVE_INFINITY;
        })
        .sort((a, b) => a - b)?.[0];
      return Number.isFinite(candidateMin ?? Number.POSITIVE_INFINITY)
        ? (candidateMin as number)
        : Number.POSITIVE_INFINITY;
    };

    const sorted = [...group.items].sort((a, b) => {
      const aEta = getEffectiveEtaSeconds(a);
      const bEta = getEffectiveEtaSeconds(b);
      if (aEta !== bEta) {
        return aEta - bEta;
      }
      return (a.lineLabel ?? '').localeCompare(b.lineLabel ?? '');
    });
    return {
      ...group,
      items: sorted,
    };
  });
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

function resolveSegmentBlockWidths(
  segments: RouteCardItem['segments'],
  railWidth: number,
): number[] {
  const fontSize = 10;
  const horizontalPadding = 8;
  const minBlockWidth = 18;
  const minWidths = segments.map((segment) => {
    const label = `${segment.durationMinutes}분`;
    const textWidth = estimateTextWidth(label, fontSize);
    return Math.max(minBlockWidth, Math.ceil(textWidth + horizontalPadding));
  });
  const minWidthSum = minWidths.reduce((sum, width) => sum + width, 0);

  if (minWidthSum >= railWidth) {
    return minWidths;
  }

  const totalWeight = Math.max(
    1,
    segments.reduce((sum, segment) => sum + Math.max(1, segment.durationMinutes), 0),
  );
  const distributable = railWidth - minWidthSum;

  return segments.map((segment, index) => {
    const weight = Math.max(1, segment.durationMinutes);
    const extraWidth = distributable * (weight / totalWeight);
    return minWidths[index] + extraWidth;
  });
}

function normalizeWidthsToRail(widths: number[], railWidth: number): number[] {
  const sum = widths.reduce((acc, width) => acc + width, 0);
  if (sum <= 0) {
    return widths;
  }
  const ratio = railWidth / sum;
  return widths.map((width) => width * ratio);
}

function RouteSegmentTimeline({
  segments,
  expanded,
  onToggle,
  nowMs,
  onPressExpanded,
}: {
  segments: RouteCardItem['segments'];
  expanded: boolean;
  onToggle: () => void;
  nowMs: number;
  onPressExpanded: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  if (segments.length === 0) {
    return null;
  }
  const railWidth = Math.max(200, windowWidth - 72);
  const calculatedWidths = resolveSegmentBlockWidths(segments, railWidth);
  const blockWidths = normalizeWidthsToRail(calculatedWidths, railWidth);
  const groupedBusSegments = buildGroupedBusByStopPair(segments);
  const timelineItems = segments.filter((segment) => segment.mode === 'bus' || segment.mode === 'subway');
  const firstTransitSegment = timelineItems[0] ?? null;
  const withStationSuffix = (name?: string) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      return '-';
    }
    if (trimmed.endsWith('역')) {
      return trimmed;
    }
    return `${trimmed}역`;
  };
  const displayedBusGroupKeys = new Set<string>();
  const timelineDisplayItems: Array<
    | {
        type: 'busGroup';
        segment: RouteCardItem['segments'][number];
        busGroup: (typeof groupedBusSegments)[number];
      }
    | {
        type: 'single';
        segment: RouteCardItem['segments'][number];
      }
  > = [];

  timelineItems.forEach((segment) => {
    if (segment.mode !== 'bus') {
      timelineDisplayItems.push({ type: 'single', segment });
      return;
    }
    const key = `${segment.startName?.trim() ?? ''}::${segment.endName?.trim() ?? ''}`;
    if (displayedBusGroupKeys.has(key)) {
      return;
    }
    displayedBusGroupKeys.add(key);
    const busGroup = groupedBusSegments.find((group) => group.key === key);
    if (!busGroup) {
      timelineDisplayItems.push({ type: 'single', segment });
      return;
    }
    timelineDisplayItems.push({ type: 'busGroup', segment, busGroup });
  });

  return (
    <View style={styles.segmentWrap}>
      <View style={styles.segmentRail}>
        {segments.map((segment, index) => {
          const visual = resolveSegmentVisual(segment);
          const isFirst = index === 0;
          const isLast = index === segments.length - 1;
          const railLabel = `${segment.durationMinutes}분`;
          return (
            <View
              key={`${segment.mode}-${segment.lineLabel ?? 'none'}-${index}`}
              style={[
                styles.segmentBlock,
                segment.mode === 'walk' ? styles.segmentBlockWalk : null,
                isFirst ? styles.segmentBlockFirst : null,
                isLast ? styles.segmentBlockLast : null,
                {
                  width: blockWidths[index],
                  backgroundColor: visual.backgroundColor,
                },
              ]}
            >
              <View style={styles.segmentInner}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.segmentInnerLabel, { color: visual.textColor }]}
                >
                  {railLabel}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.segmentToggle, { opacity: pressed ? 0.86 : 1 }]}
      >
        <Text allowFontScaling={false} style={styles.segmentToggleText}>
          {expanded ? '경로 상세 접기' : '경로 상세 펼치기'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={15}
          color="#3558C7"
        />
      </Pressable>
      {expanded ? (
        <Pressable
          onPress={onPressExpanded}
          style={({ pressed }) => [styles.verticalTimelineWrap, { opacity: pressed ? 0.96 : 1 }]}
        >
          <View pointerEvents="none" style={styles.verticalSpineLine} />
          {timelineDisplayItems.map((item, index) => {
            const segment = item.segment;
            const visual = resolveSegmentVisual(segment);
            const isBus = segment.mode === 'bus';
            const sameRouteBusGroup = item.type === 'busGroup' ? item.busGroup : null;
            const firstBus = sameRouteBusGroup?.items[0] ?? null;
            const extraBusCount = Math.max(0, (sameRouteBusGroup?.items.length ?? 0) - 1);
            const shouldShowLiveEta = firstTransitSegment === segment;
            const departureLabel =
              segment.mode === 'subway'
                ? withStationSuffix(segment.startName)
                : (segment.startName ?? '-');
            const destinationLabel =
              segment.mode === 'subway'
                ? withStationSuffix(segment.endName)
                : (segment.endName ?? '-');
            return (
              <View key={`vt-${segment.mode}-${segment.lineLabel ?? 'none'}-${index}`} style={styles.verticalTimelineRow}>
                <View style={styles.verticalAxisCol}>
                  <View
                    style={[
                      styles.verticalNode,
                      { borderColor: visual.backgroundColor },
                      segment.mode === 'bus' ? styles.verticalNodeBus : styles.verticalNodeSubway,
                    ]}
                  >
                    <Ionicons name={visual.icon} size={12} color={visual.backgroundColor} />
                  </View>
                </View>
                <View style={styles.verticalContentCol}>
                  <View style={styles.verticalTitleRow}>
                    <Text allowFontScaling={false} style={styles.verticalTitle}>
                      {segment.mode === 'subway'
                        ? withStationSuffix(segment.startName)
                        : (segment.startName ?? '-')}
                    </Text>
                    <Text allowFontScaling={false} style={styles.verticalDurationInline}>
                      {segment.durationMinutes}분
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={styles.verticalSubtitle}>
                    {(segment.mode === 'bus'
                      ? sameRouteBusGroup && sameRouteBusGroup.items.length > 1
                        ? `${firstBus?.lineLabel ?? segment.lineLabel ?? '버스'} 외 ${sameRouteBusGroup.items.length - 1}대`
                        : `${segment.lineLabel ?? '버스'}`
                      : `${visual.label}`) + ` · 출발 ${departureLabel}`}
                  </Text>
                  {shouldShowLiveEta && isBus && firstBus ? (
                    <Text allowFontScaling={false} style={styles.verticalEtaText}>
                      <Text allowFontScaling={false} style={styles.verticalBusLabelText}>
                        {firstBus.lineLabel ?? '버스'}
                      </Text>
                      <Text allowFontScaling={false}> </Text>
                      <Text allowFontScaling={false} style={styles.verticalEtaValueText}>
                        {formatEtaText(firstBus, nowMs)}
                      </Text>
                      {extraBusCount > 0 ? (
                        <Text allowFontScaling={false} style={styles.verticalBusLabelText}>
                          {` · 외 ${extraBusCount}대`}
                        </Text>
                      ) : null}
                    </Text>
                  ) : shouldShowLiveEta ? (
                    <Text allowFontScaling={false} style={styles.verticalEtaText}>
                      {toRealtimeLegendText(segment, nowMs)}
                    </Text>
                  ) : null}
                  {shouldShowLiveEta ? (
                    <Text allowFontScaling={false} style={styles.verticalRoutePairText}>
                      도착 {destinationLabel}
                    </Text>
                  ) : isBus ? (
                    <Text allowFontScaling={false} style={styles.verticalRoutePairText}>
                      도착 {destinationLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
            })}
          {timelineItems.length > 0 ? (
            <View style={styles.verticalTimelineRow}>
              <View style={styles.verticalAxisCol}>
                <View style={styles.verticalArrivalDot} />
              </View>
              <View style={styles.verticalContentCol}>
                <Text allowFontScaling={false} style={styles.verticalArrivalText}>
                  {timelineItems[timelineItems.length - 1]?.mode === 'subway'
                    ? withStationSuffix(timelineItems[timelineItems.length - 1]?.endName)
                    : timelineItems[timelineItems.length - 1]?.endName ?? '도착지'}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function RouteFeatureTags({ text }: { text: string }) {
  const tags = text
    .split('·')
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.featureTagRow}>
      {tags.map((tag) => (
        <View key={tag} style={styles.featureTagChip}>
          <Text allowFontScaling={false} style={styles.featureTagText}>
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BestRouteCard({
  item,
  onPressDetail,
  onPressSelect,
}: {
  item: RouteCardItem;
  onPressDetail: (route: RouteCardItem) => void;
  onPressSelect: (route: RouteCardItem) => void;
}) {
  const peekAnim = useRef(new Animated.Value(0)).current;
  const [isSegmentExpanded, setIsSegmentExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setIsSegmentExpanded(true);
  }, [item.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(peekAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(120),
        Animated.timing(peekAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(260),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [peekAnim]);

  const peekAnimStyle = {
    transform: [
      {
        translateY: peekAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  } as const;

  return (
    <View style={styles.bestCardWrap}>
      <View style={styles.bestHangWrap}>
        <Animated.View style={[styles.hangingTimiClip, peekAnimStyle]}>
          <TimiSvg
            variant="mint"
            pose="badge-grab"
            width={126}
            height={126}
            style={styles.timiSvg}
          />
        </Animated.View>
        <View style={styles.bestRibbon}>
          <Text allowFontScaling={false} style={styles.bestRibbonText}>
            BEST
          </Text>
          <Image source={BEST_ICON} style={styles.bestIconImage} />
        </View>
        <View pointerEvents="none" style={styles.timiHandLeft}>
          <TimiSvg
            variant="mint"
            pose="badge-grab-hand-left"
            width={34}
            height={24}
            handAngleDeg={-93}
          />
        </View>
        <View pointerEvents="none" style={styles.timiHandRight}>
          <TimiSvg
            variant="mint"
            pose="badge-grab-hand-right"
            width={34}
            height={24}
            handAngleDeg={93}
          />
        </View>
      </View>
      <Text allowFontScaling={false} style={styles.bestTitle}>
        총 {item.totalDuration}
      </Text>

      <RouteTimingRow
        departure={item.departure}
        arrival={item.arrival}
        totalFareText={item.totalFareText}
      />
      <RouteSummaryBadges item={item} />
      <RouteFeatureTags text={item.reason} />

      <RouteSegmentTimeline
        segments={item.segments}
        expanded={isSegmentExpanded}
        onToggle={() => setIsSegmentExpanded((prev) => !prev)}
        nowMs={nowMs}
        onPressExpanded={() => onPressDetail(item)}
      />
      {isWalkOnlyRoute(item.segments) ? (
        <View style={styles.walkOnlyBanner}>
          <Text allowFontScaling={false} style={styles.walkOnlyTitle}>
            현재 대중교통 경로 품질이 낮아 도보 위주 결과입니다.
          </Text>
          <View style={styles.walkOnlyActions}>
            <Pressable onPress={() => onPressDetail(item)} style={styles.walkOnlyActionButton}>
              <Text allowFontScaling={false} style={styles.walkOnlyActionText}>
                도착 시간 다시 선택
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.bestBottomRow}>
        <RouteStatusPill label={item.stabilityLabel} />
        <Pressable
          onPress={() => onPressSelect(item)}
          style={({ pressed }) => [styles.pickButton, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text allowFontScaling={false} style={styles.pickButtonText}>
            선택하기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AlternativeCard({
  item,
  onPressDetail,
}: {
  item: RouteCardItem;
  onPressDetail: (route: RouteCardItem) => void;
}) {
  const [isSegmentExpanded, setIsSegmentExpanded] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setIsSegmentExpanded(true);
  }, [item.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.altCard}>
      <View style={styles.altHead}>
        <RouteFeatureTags text={item.reason} />
        <RouteStatusPill label={item.stabilityLabel} />
      </View>
      <Text allowFontScaling={false} style={styles.altTimes}>
        {item.departure} → {item.arrival} · {item.totalDuration} · {item.totalFareText}
      </Text>
      <RouteSummaryBadges item={item} />
      <RouteSegmentTimeline
        segments={item.segments}
        expanded={isSegmentExpanded}
        onToggle={() => setIsSegmentExpanded((prev) => !prev)}
        nowMs={nowMs}
        onPressExpanded={() => onPressDetail(item)}
      />
    </View>
  );
}

function PhaseNotice({
  phase,
  subtitle,
  errorMessage,
  onRetry,
}: Pick<RouteRecommendViewProps, 'phase' | 'errorMessage' | 'onRetry' | 'subtitle'>) {
  if (phase === 'ready') {
    return null;
  }

  return (
    <View style={[styles.notice, phase === 'error' ? styles.noticeError : null]}>
      <Text allowFontScaling={false} style={styles.noticeTitle}>
        {phase === 'loading' ? '실시간 경로 계산 중' : '실시간 경로 조회 실패'}
      </Text>
      <Text allowFontScaling={false} style={styles.noticeBody}>
        {phase === 'loading' ? subtitle : (errorMessage ?? '잠시 후 다시 시도해 주세요.')}
      </Text>
      {phase === 'error' ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.noticeRetry, { opacity: pressed ? 0.86 : 1 }]}
        >
          <Text allowFontScaling={false} style={styles.noticeRetryText}>
            다시 시도
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RouteRecommendView({
  phase,
  subtitle,
  headerDestination,
  headerArrivalAt,
  recommended,
  alternatives,
  errorMessage,
  onRetry,
  onPressDetail,
  onPressSelect,
  onClose,
}: RouteRecommendViewProps) {
  const collapsedAlternativeCount = 1;
  const [isAlternativesExpanded, setIsAlternativesExpanded] = useState(false);
  const canToggleAlternatives = alternatives.length > collapsedAlternativeCount;
  const visibleAlternatives = isAlternativesExpanded
    ? alternatives
    : alternatives.slice(0, collapsedAlternativeCount);
  const hiddenAlternativeCount = Math.max(0, alternatives.length - collapsedAlternativeCount);

  useEffect(() => {
    setIsAlternativesExpanded(false);
  }, [alternatives.length]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="recommendBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#DEFFFE" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#F8F8FF" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#recommendBgGradient)" />
        </Svg>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="arrow-back-outline" size={26} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text allowFontScaling={false} style={styles.headerDestination} numberOfLines={1}>
                {headerDestination}
              </Text>
              <Text allowFontScaling={false} style={styles.headerArrival}>
                {headerArrivalAt} 도착
              </Text>
            </View>
          </View>

          <PhaseNotice
            phase={phase}
            subtitle={subtitle}
            errorMessage={errorMessage}
            onRetry={onRetry}
          />

          <View style={styles.bestCardSection}>
            <BestRouteCard
              item={recommended}
              onPressDetail={onPressDetail}
              onPressSelect={onPressSelect}
            />
          </View>

          <View style={styles.altSection}>
            <Text allowFontScaling={false} style={styles.altSectionTitle}>
              다른 경로
            </Text>
            <View style={styles.altList}>
              {visibleAlternatives.map((route) => (
                <AlternativeCard key={route.id} item={route} onPressDetail={onPressDetail} />
              ))}
            </View>
            {canToggleAlternatives ? (
              <Pressable
                onPress={() => setIsAlternativesExpanded((prev) => !prev)}
                style={({ pressed }) => [styles.altToggleButton, { opacity: pressed ? 0.86 : 1 }]}
              >
                <Text allowFontScaling={false} style={styles.altToggleButtonText}>
                  {isAlternativesExpanded
                    ? '다른 경로 접기'
                    : `다른 경로 ${hiddenAlternativeCount}개 더 보기`}
                </Text>
                <Ionicons
                  name={isAlternativesExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color="#0D2B2A"
                />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => onPressSelect(recommended)}
            style={({ pressed }) => [styles.ctaButton, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text allowFontScaling={false} style={styles.ctaButtonText}>
              BEST 경로 선택
            </Text>
          </Pressable>
        </ScrollView>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.floatingRefreshButton, { opacity: pressed ? 0.88 : 1 }]}
        >
          <Ionicons name="refresh" size={24} color="#2F63D8" />
        </Pressable>

        <HomeTabBar status="relaxed" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 144,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6ED6CD',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 8,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerDestination: {
    fontFamily: 'Pretendard-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: '#6F8F90',
  },
  headerArrival: {
    fontFamily: 'Pretendard-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 30,
    color: '#0D2B2A',
  },
  bestCardSection: {
    position: 'relative',
    marginTop: 2,
  },
  bestHangWrap: {
    position: 'absolute',
    right: -3,
    top: -58,
    zIndex: 25,
  },
  hangingTimiClip: {
    zIndex: 10,
    width: 136,
    height: 56,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    marginBottom: 0,
    marginRight: 0,
  },
  timiSvg: {
    marginTop: -4,
    marginLeft: 3,
  },
  timiHandLeft: {
    position: 'absolute',
    left: 12,
    top: 50,
    zIndex: 40,
  },
  timiHandRight: {
    position: 'absolute',
    right: 4,
    top: 48,
    zIndex: 30,
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8FDCDA',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  noticeError: {
    borderColor: '#EF9090',
  },
  noticeTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#0D2B2A',
  },
  noticeBody: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#6F8F90',
  },
  noticeRetry: {
    marginTop: 4,
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4B5B5',
  },
  noticeRetryText: {
    fontFamily: 'Pretendard-SemiBold',
    color: '#D24A4A',
    fontSize: 12,
  },
  bestCardWrap: {
    position: 'relative',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.93)',
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 18,
    gap: 10,
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 5,
  },
  bestRibbon: {
    zIndex: 20,
    minWidth: 136,
    height: 58,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: 'rgba(108, 211, 204, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#5FD3CB',
    shadowOpacity: 0.78,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 9,
  },
  bestIconImage: {
    width: 17,
    height: 17,
    resizeMode: 'contain',
  },
  bestRibbonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    lineHeight: 38,
    color: '#FFFFFF',
  },
  bestTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 30,
    lineHeight: 34,
    color: '#0D2B2A',
  },
  featureTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  featureTagChip: {
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#DAE6FF',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTagText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    lineHeight: 14,
    color: '#3558C7',
  },
  timingWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(111,143,144,0.3)',
    minHeight: 56,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  timingMetaText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 22,
    color: '#234041',
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryBadge: {
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: '#F3F7FA',
    borderWidth: 1,
    borderColor: '#E0E8EE',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadgeText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 15,
    color: '#4B6270',
  },
  timingCol: {
    gap: 8,
  },
  timingColRight: {
    alignItems: 'flex-end',
  },
  timingLabel: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#6F8F90',
  },
  timingValue: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 40,
    lineHeight: 42,
    color: '#0D2B2A',
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 10,
    gap: 6,
  },
  timingLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#8FA5A6',
    opacity: 0.65,
  },
  durationPill: {
    height: 41,
    minWidth: 70,
    borderRadius: 999,
    backgroundColor: '#6F8F90',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  durationText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  segmentWrap: {
    gap: 8,
  },
  segmentRail: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 22,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E9EEF3',
  },
  segmentBlock: {
    minHeight: 22,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  segmentBlockWalk: {
    minWidth: 0,
  },
  segmentBlockFirst: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  segmentBlockLast: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    borderRightWidth: 0,
  },
  segmentInner: {
    height: 22,
    minWidth: 0,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 1,
  },
  segmentInnerLabel: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 10,
    lineHeight: 12,
    flexShrink: 1,
  },
  segmentInnerWalkTimeText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 10,
    lineHeight: 12,
    flexShrink: 1,
  },
  segmentInnerEtaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 9,
    lineHeight: 11,
    flexShrink: 1,
  },
  segmentInnerEtaPendingText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 8,
    lineHeight: 10,
    opacity: 0.9,
    flexShrink: 1,
  },
  segmentToggle: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F6FF',
  },
  segmentToggleText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#3558C7',
  },
  segmentLegendRow: {
    gap: 8,
  },
  verticalTimelineWrap: {
    position: 'relative',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5EBF5',
    backgroundColor: '#FAFCFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  verticalSpineLine: {
    position: 'absolute',
    left: 21,
    top: 22,
    bottom: 24,
    width: 2,
    backgroundColor: '#D8E1EF',
  },
  verticalTimelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  verticalAxisCol: {
    width: 24,
    alignItems: 'center',
    position: 'relative',
  },
  verticalNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  verticalNodeBus: {
    backgroundColor: '#F8FBFF',
  },
  verticalNodeSubway: {
    backgroundColor: '#FBF7FF',
  },
  verticalContentCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 3,
  },
  verticalTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  verticalTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 22,
    color: '#111827',
  },
  verticalDurationInline: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#3558C7',
  },
  verticalSubtitle: {
    marginTop: 1,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    lineHeight: 17,
    color: '#4B6270',
  },
  verticalDepartureInlineText: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  verticalRoutePairText: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
  },
  verticalEtaText: {
    marginTop: 2,
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#1F2A37',
  },
  verticalBusLabelText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#1F2A37',
  },
  verticalEtaValueText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#C43B3B',
  },
  verticalArrivalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9CA3AF',
    marginTop: 2,
  },
  verticalArrivalText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 22,
    color: '#111827',
    marginTop: 1,
  },
  segmentLegendItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  segmentLegendChip: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentLegendDetailCol: {
    flex: 1,
    minWidth: 0,
  },
  segmentLegendDetailText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#1F2A37',
  },
  segmentLegendLineListText: {
    marginTop: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 11,
    lineHeight: 15,
    color: '#4B6270',
  },
  segmentLegendChipCompact: {
    paddingHorizontal: 7,
    gap: 3,
  },
  segmentLegendTypeText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 11,
    lineHeight: 14,
    minWidth: 0,
  },
  segmentLegendTypeTextCompact: {
    minWidth: 0,
  },
  segmentLegendText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 54,
  },
  segmentLegendEtaText: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 10,
    lineHeight: 13,
    color: '#3558C7',
  },
  segmentLegendEtaPendingText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 10,
    lineHeight: 13,
    opacity: 0.85,
    color: '#51606A',
  },
  bestBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    minWidth: 56,
    height: 41,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  statusRelaxedPill: {
    backgroundColor: '#E4FFFD',
  },
  statusWarningPill: {
    backgroundColor: '#FFF3DB',
  },
  statusDangerPill: {
    backgroundColor: '#FDE9EA',
  },
  statusPillText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
  },
  statusRelaxedText: {
    color: '#58C7C2',
  },
  statusWarningText: {
    color: '#F59E0B',
  },
  statusDangerText: {
    color: '#D24A4A',
  },
  pickButton: {
    minWidth: 95,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#34B6AE',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 5,
  },
  pickButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  altSection: {
    gap: 10,
  },
  altSectionTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 32,
    color: '#0D2B2A',
    marginLeft: 4,
  },
  altList: {
    gap: 10,
  },
  altToggleButton: {
    marginTop: 2,
    alignSelf: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: '#D6EFEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  altToggleButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    lineHeight: 18,
    color: '#0D2B2A',
  },
  altCard: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  altHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  altTitle: {
    flex: 1,
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#0D2B2A',
  },
  altSummary: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    lineHeight: 20,
    color: '#6F8F90',
  },
  altTimes: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    lineHeight: 20,
    color: '#375152',
  },
  walkOnlyBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1CE8F',
    backgroundColor: '#FFF8E9',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  walkOnlyTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#8A5A00',
  },
  walkOnlyActions: {
    flexDirection: 'row',
    gap: 6,
  },
  walkOnlyActionButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5B760',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkOnlyActionText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: '#8A5A00',
  },
  ctaButton: {
    marginTop: 4,
    minHeight: 62,
    borderRadius: 999,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34B6AE',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 6,
  },
  ctaButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontWeight: '700',
    fontSize: 20,
    color: '#FFFFFF',
  },
  floatingRefreshButton: {
    position: 'absolute',
    right: 16,
    bottom: 112,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D2B2A',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
});
