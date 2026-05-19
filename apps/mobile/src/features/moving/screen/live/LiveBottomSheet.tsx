import { useMemo } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { Pressable, View } from 'react-native';
import type { LiveSheetProps } from './types';
import { QuickTransitSummary } from './QuickTransitSummary';
import { DetailTransitPanel } from './DetailTransitPanel';
import { FullTransitPanel } from './FullTransitPanel';

interface Props {
  data: LiveSheetProps;
  sheetRef: React.RefObject<BottomSheet | null>;
  index: number;
  onChange: (index: number) => void;
  stopsOpen: boolean;
  onToggleStops: () => void;
  bottomInset?: number;
  contentBottomPadding?: number;
  topInset?: number;
  onExpandFromSummary?: () => void;
}

export function LiveBottomSheet({
  data,
  sheetRef,
  index,
  onChange,
  stopsOpen,
  onToggleStops,
  bottomInset = 0,
  contentBottomPadding = 0,
  topInset = 0,
  onExpandFromSummary,
}: Props) {
  const snapPoints = useMemo(() => ['30%', '58%', '88%'], []);

  return (
    <BottomSheet
      ref={sheetRef}
      style={{ zIndex: 40, elevation: 40 }}
      index={index}
      snapPoints={snapPoints}
      onChange={onChange}
      animateOnMount
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      enableOverDrag
      overDragResistanceFactor={5}
      enableContentPanningGesture
      enableHandlePanningGesture
      bottomInset={bottomInset}
      topInset={topInset}
      handleComponent={() => (
        <View style={{ paddingTop: 6, paddingBottom: 6, alignItems: 'center' }}>
          <View
            style={{
              width: 44,
              height: 5,
              borderRadius: 999,
              backgroundColor: '#CBD5E1',
            }}
          />
        </View>
      )}
      backgroundStyle={{
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      {index === 0 ? (
        <Pressable onPress={onExpandFromSummary}>
          <QuickTransitSummary data={data} />
        </Pressable>
      ) : null}
      {index === 1 ? <DetailTransitPanel data={data} /> : null}
      {index >= 2 ? <FullTransitPanel data={data} stopsOpen={stopsOpen} onToggleStops={onToggleStops} bottomPadding={contentBottomPadding} /> : null}
    </BottomSheet>
  );
}
