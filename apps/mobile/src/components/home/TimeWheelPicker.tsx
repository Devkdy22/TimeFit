import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { colors } from '../../theme/colors';

interface TimeWheelPickerProps {
  visible: boolean;
  initialTime: string;
  accentColor: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;
const EDGE_BUFFER_ROWS = Math.floor((VISIBLE_ROWS - 1) / 2);

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function toTimeParts(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  return {
    hour: Number.isNaN(hour) ? 9 : Math.max(0, Math.min(23, hour)),
    minute: Number.isNaN(minute) ? 0 : Math.max(0, Math.min(59, minute)),
  };
}

function toClockText(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function WheelColumn({
  data,
  selected,
  onSelected,
  onPreviewChange,
}: {
  data: number[];
  selected: number;
  onSelected: (next: number) => void;
  onPreviewChange?: (next: number) => void;
}) {
  const listRef = useRef<FlatList<number | null>>(null);
  const isDraggingRef = useRef(false);
  const isMomentumRef = useRef(false);
  const lastOffsetRef = useRef(selected * ITEM_HEIGHT);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minRawIndex = EDGE_BUFFER_ROWS;
  const maxRawIndex = EDGE_BUFFER_ROWS + data.length - 1;
  const wheelData = useMemo<Array<number | null>>(
    () => [
      ...Array.from({ length: EDGE_BUFFER_ROWS }, () => null),
      ...data,
      ...Array.from({ length: EDGE_BUFFER_ROWS }, () => null),
    ],
    [data],
  );
  const toCenterOffset = (rawIndex: number) => {
    // snapToAlignment="center" 기준 보정값
    return Math.max(0, rawIndex * ITEM_HEIGHT - WHEEL_PADDING);
  };
  const snapOffsets = useMemo(
    () => Array.from({ length: maxRawIndex - minRawIndex + 1 }, (_, i) => toCenterOffset(i + minRawIndex)),
    [maxRawIndex, minRawIndex],
  );
  const initialRawIndex = Math.max(
    minRawIndex,
    Math.min(maxRawIndex, data.indexOf(selected) + EDGE_BUFFER_ROWS),
  );
  const [focusedRawIndex, setFocusedRawIndex] = useState(initialRawIndex);
  const focusedRawIndexRef = useRef(initialRawIndex);

  const clampRawIndex = (rawIndex: number) => {
    return Math.max(minRawIndex, Math.min(maxRawIndex, rawIndex));
  };

  const updateFocusedFromOffset = (offsetY: number) => {
    const nextRawIndex = clampRawIndex(Math.round((offsetY + WHEEL_PADDING) / ITEM_HEIGHT));
    if (nextRawIndex === focusedRawIndexRef.current) {
      return nextRawIndex;
    }
    focusedRawIndexRef.current = nextRawIndex;
    setFocusedRawIndex(nextRawIndex);
    const nextValue = data[nextRawIndex - EDGE_BUFFER_ROWS];
    if (typeof nextValue === 'number') {
      onPreviewChange?.(nextValue);
    }
    return nextRawIndex;
  };

  useEffect(() => {
    if (isDraggingRef.current || isMomentumRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      const selectedIndex = data.indexOf(selected);
      if (selectedIndex < 0) {
        return;
      }
      const targetOffset = toCenterOffset(selectedIndex + EDGE_BUFFER_ROWS);
      lastOffsetRef.current = targetOffset;
      updateFocusedFromOffset(targetOffset);
      listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
    });
  }, [data, selected]);

  const settleAtOffset = (offsetY: number) => {
    const clampedRawIndex = updateFocusedFromOffset(offsetY);
    const valueIndex = clampedRawIndex - EDGE_BUFFER_ROWS;
    const next = data[valueIndex];
    if (next !== selected) {
      onSelected(next);
    }
    const snappedOffset = toCenterOffset(clampedRawIndex);
    lastOffsetRef.current = snappedOffset;
    listRef.current?.scrollToOffset({ offset: snappedOffset, animated: false });
  };

  const scheduleSettle = (delay = 60) => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current && !isMomentumRef.current) {
        settleAtOffset(lastOffsetRef.current);
      }
      settleTimerRef.current = null;
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const renderItem = ({ item, index }: ListRenderItemInfo<number | null>) => {
    if (item === null) {
      return <View style={styles.itemRow} />;
    }

    const distanceFromFocus = Math.abs(index - focusedRawIndex);
    const emphasis = Math.max(0, 1 - distanceFromFocus / 2.4);
    const eased = emphasis * emphasis;
    const dynamicFontSize = 28 + eased * 10;
    const dynamicLineHeight = 32 + eased * 10;
    const dynamicOpacity = 0.45 + eased * 0.55;
    const isCenter = distanceFromFocus < 0.55;

    return (
      <View style={styles.itemRow}>
        <Text
          style={[
            styles.itemText,
            isCenter ? styles.itemTextActive : null,
            {
              fontSize: dynamicFontSize,
              lineHeight: dynamicLineHeight,
              opacity: dynamicOpacity,
            },
          ]}
        >
          {String(item).padStart(2, '0')}
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      ref={listRef}
      data={wheelData}
      keyExtractor={(item, index) => (item === null ? `empty-${index}` : `${item}`)}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      snapToOffsets={snapOffsets}
      decelerationRate={Platform.OS === 'ios' ? 0.992 : 0.992}
      bounces={false}
      scrollEventThrottle={16}
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      initialScrollIndex={Math.max(0, data.indexOf(selected))}
      onScrollBeginDrag={() => {
        isDraggingRef.current = true;
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
      }}
      onMomentumScrollBegin={() => {
        isMomentumRef.current = true;
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
      }}
      onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        isMomentumRef.current = false;
        isDraggingRef.current = false;
        lastOffsetRef.current = event.nativeEvent.contentOffset.y;
        settleAtOffset(event.nativeEvent.contentOffset.y);
      }}
      onScrollEndDrag={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        isDraggingRef.current = false;
        lastOffsetRef.current = event.nativeEvent.contentOffset.y;
        if (!isMomentumRef.current) {
          // 손을 천천히 떼는 경우 snap 정렬 완료 후 값을 확정한다.
          scheduleSettle(80);
        }
      }}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        lastOffsetRef.current = offsetY;
        updateFocusedFromOffset(offsetY);
      }}
    />
  );
}

export function TimeWheelPicker({ visible, initialTime, accentColor, onClose, onConfirm }: TimeWheelPickerProps) {
  const parsed = useMemo(() => toTimeParts(initialTime), [initialTime]);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setHour(parsed.hour);
    setMinute(parsed.minute);
  }, [parsed.hour, parsed.minute, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.title}>도착 시간 설정</Text>
            <Pressable onPress={() => onConfirm(toClockText(hour, minute))} hitSlop={8}>
              <Text style={[styles.doneText, { color: accentColor }]}>완료</Text>
            </Pressable>
          </View>

          <View style={styles.wheelsWrap}>
            <View style={[styles.selectionBar, { borderColor: `${accentColor}33` }]} />

            <View style={styles.wheelColumn}>
              <WheelColumn
                data={HOURS}
                selected={hour}
                onSelected={setHour}
                onPreviewChange={setHour}
              />
            </View>

            <Text style={styles.colon}>:</Text>

            <View style={styles.wheelColumn}>
              <WheelColumn
                data={MINUTES}
                selected={minute}
                onSelected={setMinute}
                onPreviewChange={setMinute}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 44, 42, 0.2)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 18,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cancelText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  doneText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
  },
  wheelsWrap: {
    height: PICKER_HEIGHT,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#F8FCFC',
    borderWidth: 1,
    borderColor: 'rgba(88, 199, 194, 0.2)',
    shadowColor: '#DDEDED',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  wheelColumn: {
    width: 96,
    height: PICKER_HEIGHT,
  },
  colon: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 30,
    color: colors.textPrimary,
    marginHorizontal: 6,
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING,
  },
  itemRow: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 28,
    lineHeight: 32,
    color: '#8EA3A0',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  itemTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 42,
    lineHeight: 44,
    color: colors.textPrimary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
