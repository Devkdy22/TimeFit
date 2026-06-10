import { StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { LiveSheetProps } from './types';
import { AlternateRouteCard } from './AlternateRouteCard';
import { CurrentSegmentCard } from './CurrentSegmentCard';
import { NextActionCard } from './NextActionCard';
import { RealtimeStatusGrid } from './RealtimeStatusGrid';
import { StopsAccordion } from './StopsAccordion';
import { TransitBottomActions } from './TransitBottomActions';

interface Props {
  data: LiveSheetProps;
  stopsOpen: boolean;
  onToggleStops: () => void;
  bottomPadding?: number;
}

export function FullTransitPanel({ data, stopsOpen, onToggleStops, bottomPadding = 36 }: Props) {
  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
    >
      <CurrentSegmentCard data={data} />
      <StopsAccordion data={data} open={stopsOpen} onToggle={onToggleStops} />
      <NextActionCard data={data} />
      <RealtimeStatusGrid data={data} />
      <AlternateRouteCard visible={data.status === 'urgent'} />
      <TransitBottomActions />
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 12, paddingTop: 4 },
});
