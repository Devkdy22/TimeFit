import { StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { LiveSheetProps } from './types';
import { CurrentSegmentCard } from './CurrentSegmentCard';
import { LiveTimeline } from './LiveTimeline';
import { NextActionCard } from './NextActionCard';
import { QuickActionRow } from './QuickActionRow';
import { RealtimeStatusGrid } from './RealtimeStatusGrid';

export function DetailTransitPanel({ data }: { data: LiveSheetProps }) {
  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={styles.wrap}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
    >
      <CurrentSegmentCard data={data} />
      <LiveTimeline data={data} />
      <NextActionCard data={data} />
      <RealtimeStatusGrid data={data} />
      <QuickActionRow />
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  wrap: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 14,
    paddingBottom: 20,
  },
});
