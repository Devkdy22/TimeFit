import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { LiveSheetProps } from './types';
import { statusTone } from './ui';

interface Props {
  data: LiveSheetProps;
  open: boolean;
  onToggle: () => void;
}

export function StopsAccordion({ data, open, onToggle }: Props) {
  const tone = statusTone(data.status);
  const currentIndex = Math.max(0, data.detailLines.findIndex((line) => line.isCurrent));
  const visible = data.detailLines;
  const progress = visible.length <= 1 ? 0 : Math.max(0, Math.min(1, currentIndex / (visible.length - 1)));
  const pulse = useSharedValue(0.2);
  pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.34 }],
  }));
  return (
    <View style={styles.card}>
      <Pressable style={styles.head} onPress={onToggle}>
        <Text style={styles.headText}>남은 정류장/역 {data.detailLines.length}개</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.progressWrap}>
        <View style={styles.baseRail} />
        <View style={[styles.activeRail, { backgroundColor: tone, width: `${progress * 100}%` }]} />
        {visible.map((line, index) => {
          const absoluteIndex = open ? index : index;
          const passed = absoluteIndex < currentIndex;
          const current = line.isCurrent;
          return (
            <View key={line.id} style={[styles.progressNode, { width: `${100 / Math.max(visible.length, 2)}%` }]}>
              <View style={styles.nodeTop}>
                {current ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.pulseRing, { borderColor: tone }, pulseStyle]}
                  />
                ) : null}
                <View
                  style={[
                    styles.dot,
                    passed ? styles.dotPassed : null,
                    current ? { backgroundColor: tone, borderColor: tone, transform: [{ scale: 1.2 }] } : null,
                  ]}
                />
              </View>
              <Text style={[styles.name, current ? styles.currentName : null]} numberOfLines={1}>
                {line.stopName}
              </Text>
              <Text style={styles.eta}>{line.etaText}</Text>
            </View>
          );
        })}
      </View>
      </ScrollView>
      {!open && data.detailLines.length > 8 ? <Text style={styles.more}>전체 보기</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#475569' },
  scrollContent: { minWidth: '100%' },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 2,
    width: '100%',
    position: 'relative',
    minHeight: 30,
    overflow: 'visible',
  },
  baseRail: { position: 'absolute', left: 5, right: 5, top: 11, height: 2, backgroundColor: '#E2E8F0' },
  activeRail: { position: 'absolute', left: 5, top: 11, height: 2 },
  progressNode: { minWidth: 0, alignItems: 'center', overflow: 'visible' },
  nodeTop: { alignItems: 'center', marginBottom: 8, justifyContent: 'center', minHeight: 16, overflow: 'visible' },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#94A3B8', backgroundColor: '#fff' },
  dotPassed: { backgroundColor: '#CBD5E1', borderColor: '#CBD5E1' },
  name: { fontFamily: 'Pretendard-Medium', fontSize: 11, color: '#64748B' },
  currentName: { fontFamily: 'Pretendard-Bold', color: '#0F172A' },
  eta: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#64748B', marginTop: 1 },
  more: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#34B6AE' },
});
