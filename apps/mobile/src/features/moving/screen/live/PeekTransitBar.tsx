import { StyleSheet, Text, View } from 'react-native';
import type { LiveSheetProps } from './types';
import { modeBadgeColor, statusTone, stripPlusDuration } from './ui';

export function PeekTransitBar({ data }: { data: LiveSheetProps }) {
  const current = data.detailLines.find((line) => line.isCurrent) ?? data.detailLines[0];
  const tone = statusTone(data.status);
  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: modeBadgeColor(current?.mode) }]}>
        <Text style={styles.badgeText}>{current?.mode === 'bus' ? '버스' : current?.mode === 'subway' ? '지하철' : '도보'}</Text>
      </View>
      <Text style={styles.title}>{current?.lineLabel ?? '이동 중'}</Text>
      <Text style={[styles.time, { color: tone }]}>{stripPlusDuration(current?.etaText ?? data.remainingTime)} 남음</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontFamily: 'Pretendard-Bold', fontSize: 11 },
  title: { fontFamily: 'Pretendard-SemiBold', fontSize: 18, color: '#0F172A' },
  time: { fontFamily: 'Pretendard-Bold', fontSize: 15 },
});
