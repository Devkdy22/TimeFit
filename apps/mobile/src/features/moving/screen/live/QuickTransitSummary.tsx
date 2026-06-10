import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { modeBadgeColor, statusPrimary, statusTone, stripPlusDuration } from './ui';

export function QuickTransitSummary({ data }: { data: LiveSheetProps }) {
  const current = data.detailLines.find((line) => line.isCurrent) ?? data.detailLines[0];
  const currentIndex = Math.max(0, data.detailLines.findIndex((line) => line.isCurrent));
  const remainingStops = Math.max(0, data.detailLines.length - currentIndex - 1);
  const progress = data.detailLines.length <= 1 ? 0 : Math.max(0, Math.min(1, currentIndex / (data.detailLines.length - 1)));
  const nextLine = data.detailLines[Math.min(data.detailLines.length - 1, currentIndex + 1)];
  const nextStop = nextLine?.stopName ?? data.upcomingActionSubtitle;
  const nextStopLabel = nextStop && !nextStop.endsWith('역') ? `${nextStop}역` : (nextStop || '-');
  const cleanLineLabel = (nextLine?.lineLabel ?? '').replace(/^수도권\s*/g, '').trim();
  const boardingHintMatch = `${data.upcomingActionSubtitle ?? ''}`.match(/(\d+번\s*(?:출구|탑승|승강장))/);
  const boardingHint = boardingHintMatch?.[1] ?? null;
  const pulse = useSharedValue(0.2);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));
  const upcomingSteps = data.detailLines
    .slice(currentIndex + 1)
    .filter((line, index, arr) => {
      if (index === 0) return true;
      const prev = arr[index - 1];
      return !(prev.mode === line.mode && prev.lineLabel === line.lineLabel && prev.stopName === line.stopName);
    })
    .slice(0, 3)
    .map((line) => {
      if (line.mode === 'bus') return `버스 ${line.lineLabel}`;
      if (line.mode === 'subway') return `${line.stopName}역 ${line.lineLabel.replace(/^수도권\s*/g, '').trim()}`;
      return `도보`;
    });
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={[styles.modeBadge, { backgroundColor: modeBadgeColor(current?.mode) }]}>
          <Text style={styles.modeBadgeText}>{current?.mode === 'bus' ? '버스' : current?.mode === 'subway' ? '지하철' : '도보'}</Text>
        </View>
        <Text style={styles.title}>{current?.lineLabel ?? data.mainAction}</Text>
        <View style={[styles.statusChip, { backgroundColor: `${statusTone(data.status)}16` }]}>
          <Text style={[styles.statusChipText, { color: statusTone(data.status) }]}>{statusPrimary(data.status)}</Text>
        </View>
      </View>
      <Text style={styles.sub}>{current?.stopName ?? data.stageText}</Text>
      <View style={styles.bottomRow}>
        <Text style={[styles.eta, { color: statusTone(data.status) }]}>{stripPlusDuration(data.remainingTime)} 남음</Text>
        <Text style={styles.remainMeta}>{remainingStops}정거장 남음</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>도착 예정 {data.arrivalTime}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>현재 위치 {current?.stopName ?? '-'}</Text>
        <Text style={styles.metaDot}>→</Text>
        <Text style={styles.metaText} numberOfLines={1}>다음 위치 {nextStop || '-'}</Text>
      </View>
      <View style={styles.routeBarWrap}>
        <View style={styles.routeBase} />
        <View style={[styles.routeActive, { width: `${progress * 100}%`, backgroundColor: statusTone(data.status) }]} />
        <View style={styles.routeNodesRow}>
          {data.detailLines.slice(0, 6).map((line, index) => {
            const active = index === currentIndex;
            const passed = index < currentIndex;
            return (
              <View
                key={line.id}
                style={[
                  styles.routeNodeWrap,
                  { width: `${100 / Math.max(Math.min(data.detailLines.length, 6), 2)}%` },
                ]}
              >
                {active ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.pulseRing, { borderColor: statusTone(data.status) }, pulseStyle]}
                  />
                ) : null}
                <View
                  style={[
                    styles.routeNode,
                    active
                      ? { borderColor: statusTone(data.status), backgroundColor: statusTone(data.status), transform: [{ scale: 1.2 }] }
                      : passed
                        ? styles.routeNodePassed
                        : null,
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.nextGuideCard}>
        <Text style={styles.planTitle}>다음 행동 순서</Text>
        {nextLine?.mode === 'subway' ? (
          <Text style={styles.subwayGuide} numberOfLines={2}>
            {nextStopLabel}에서 {cleanLineLabel || '지하철'} 탑승
            {boardingHint ? ` · ${boardingHint} 이용 시 환승/하차 동선 유리` : ''}
          </Text>
        ) : null}
        <View style={styles.planRow}>
          {upcomingSteps.length > 0 ? (
            upcomingSteps.map((step, index) => (
              <View key={`${step}-${index}`} style={styles.stepWrap}>
                <View style={styles.stepChip}>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
                {index < upcomingSteps.length - 1 ? <Ionicons name="chevron-forward" size={13} color="#0E2C2C" /> : null}
              </View>
            ))
          ) : (
            <Text style={styles.guide} numberOfLines={1}>
              {data.upcomingActionTitle} {data.upcomingActionSubtitle}
            </Text>
          )}
        </View>
      </View>
      {data.status === 'urgent' ? (
        <View style={styles.altRow}>
          <Text style={styles.altText}>더 빠른 경로 발견</Text>
          <View style={styles.altCta}><Text style={styles.altCtaText}>경로 변경</Text></View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 166, paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  modeBadgeText: { color: '#fff', fontFamily: 'Pretendard-Bold', fontSize: 11 },
  statusChip: { marginLeft: 'auto', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11 },
  title: { fontFamily: 'Pretendard-ExtraBold', fontSize: 19, color: '#0F172A', flexShrink: 1 },
  sub: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#475569', lineHeight: 18 },
  guide: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#0E2C2C', lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 16 },
  metaDot: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#94A3B8' },
  metaText: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#64748B' },
  nextGuideCard: {
    borderRadius: 12,
    backgroundColor: '#EAF8F7',
    borderWidth: 1,
    borderColor: '#58C7C2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  planTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#0E2C2C' },
  planRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  stepWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepChip: { borderRadius: 999, backgroundColor: '#D8F1EF', paddingHorizontal: 8, paddingVertical: 4 },
  stepText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#0E2C2C' },
  subwayGuide: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#0E2C2C', marginTop: 4, lineHeight: 17 },
  bottomRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', minHeight: 22 },
  eta: { fontFamily: 'Pretendard-Bold', fontSize: 18 },
  remainMeta: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#475569' },
  routeBarWrap: { height: 24, justifyContent: 'center', position: 'relative', marginTop: 2, width: '100%', overflow: 'visible' },
  routeBase: { position: 'absolute', left: 5, right: 5, top: 11, height: 2, backgroundColor: '#E2E8F0', borderRadius: 999 },
  routeActive: { position: 'absolute', left: 5, top: 11, height: 2, borderRadius: 999 },
  routeNodesRow: { position: 'absolute', left: 0, right: 0, top: 7, flexDirection: 'row' },
  routeNodeWrap: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', minHeight: 14 },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  routeNode: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#94A3B8', backgroundColor: '#fff' },
  routeNodePassed: { borderColor: '#CBD5E1', backgroundColor: '#CBD5E1' },
  altRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  altText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#0E2C2C' },
  altCta: { borderRadius: 999, backgroundColor: '#58C7C2', paddingHorizontal: 10, paddingVertical: 5 },
  altCtaText: { fontFamily: 'Pretendard-Bold', fontSize: 11, color: '#0E2C2C' },
});
