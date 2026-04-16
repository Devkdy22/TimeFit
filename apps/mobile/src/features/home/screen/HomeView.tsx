import { useEffect, useRef } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { TimiAnimated } from '../../../components/character/TimiAnimated';
import { LocationIcon } from '../../../components/icon/LocationIcon';
import { BottomCTA, BottomSheet, ListItemCard, ScreenContainer, StatusBadge, TimeDisplay } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import type { UiStatus } from '../../../theme/status-config';
import type { RoutineItem } from '../../../mocks/route/types';
import type { LocationField, SavedPlace } from '../../commute-state/context';
import type { TimiInteraction, TimiMood } from '../../../components/character/useTimiAnimation';
import { KakaoMapWebView } from '../../map/webview/KakaoMapWebView';
import type { KakaoMapWebViewEvent, KakaoMapWebViewHandle } from '../../map/webview/types';

const KAKAO_JAVASCRIPT_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

interface MapCenter {
  lat: number;
  lng: number;
  address?: string;
}

export interface HomeViewProps {
  status: UiStatus;
  statusLabel: string;
  arrivalAt: string | null;
  headline: string;
  body: string;
  cta: string;
  origin: string;
  destination: string;
  hasDestination: boolean;
  recentPlaces: SavedPlace[];
  savedPlaces: SavedPlace[];
  routinePreview: RoutineItem[];
  isSheetVisible: boolean;
  isSheetClosing: boolean;
  selectedFeedbackId: string | null;
  activeField: LocationField;
  sheetQuery: string;
  filteredPlaces: SavedPlace[];
  latestSelectedPlace: SavedPlace | null;
  isSaveNameOpen: boolean;
  saveName: string;
  timiMood: TimiMood;
  timiInteraction: TimiInteraction;
  timiSignal: number;
  isTimePickerVisible: boolean;
  tempTime: Date;
  mapCenterLabel: string;
  mapFocusPlace: SavedPlace | null;
  mapFocusKey: number;
  isMapExpanded: boolean;
  onToggleMapExpand: () => void;
  onOpenOriginSheet: () => void;
  onOpenDestinationSheet: () => void;
  onCloseSheet: () => void;
  onChangeSheetQuery: (next: string) => void;
  onSelectSearchPlace: (place: SavedPlace) => void;
  onSelectRecentPlace: (id: string) => void;
  onSelectSavedPlace: (id: string) => void;
  onMapCenterChange: (center: MapCenter) => void;
  onConfirmMapCenter: () => void;
  onPressRecentApply: (id: string) => void;
  onPressSavedApply: (id: string) => void;
  onOpenSaveName: () => void;
  onChangeSaveName: (next: string) => void;
  onSavePlace: () => void;
  onCancelSaveName: () => void;
  onOpenTimePicker: () => void;
  onChangeArrivalTime: (event: DateTimePickerEvent, date?: Date) => void;
  onConfirmTimePicker: () => void;
  onCancelTimePicker: () => void;
  onPressRoutines: () => void;
  onPressTransit: () => void;
}

function PlaceQuickRow({
  place,
  onPress,
  selected,
  disabled,
}: {
  place: SavedPlace;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.placeRow,
        selected ? styles.placeRowSelected : null,
        { opacity: disabled ? 0.6 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      <View style={styles.placeIconWrap}>
        <LocationIcon type={place.iconType} size={28} />
      </View>
      <View style={styles.placeTextWrap}>
        <Text style={styles.placeTitle}>{place.name}</Text>
        <Text numberOfLines={1} style={styles.placeSubtitle}>{place.address}</Text>
      </View>
    </Pressable>
  );
}

export function HomeView({
  status,
  statusLabel,
  arrivalAt,
  headline,
  body,
  cta,
  origin,
  destination,
  hasDestination,
  recentPlaces,
  savedPlaces,
  routinePreview,
  isSheetVisible,
  isSheetClosing,
  selectedFeedbackId,
  activeField,
  sheetQuery,
  filteredPlaces,
  latestSelectedPlace,
  isSaveNameOpen,
  saveName,
  timiMood,
  timiInteraction,
  timiSignal,
  isTimePickerVisible,
  tempTime,
  mapCenterLabel,
  mapFocusPlace,
  mapFocusKey,
  isMapExpanded,
  onToggleMapExpand,
  onOpenOriginSheet,
  onOpenDestinationSheet,
  onCloseSheet,
  onChangeSheetQuery,
  onSelectSearchPlace,
  onSelectRecentPlace,
  onSelectSavedPlace,
  onMapCenterChange,
  onConfirmMapCenter,
  onPressRecentApply,
  onPressSavedApply,
  onOpenSaveName,
  onChangeSaveName,
  onSavePlace,
  onCancelSaveName,
  onOpenTimePicker,
  onChangeArrivalTime,
  onConfirmTimePicker,
  onCancelTimePicker,
  onPressRoutines,
  onPressTransit,
}: HomeViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<KakaoMapWebViewHandle>(null);
  const mapExpandAnim = useRef(new Animated.Value(isMapExpanded ? 1 : 0)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!mapFocusPlace || !isSheetVisible) {
      return;
    }
    mapRef.current?.moveTo({ lat: mapFocusPlace.latitude, lng: mapFocusPlace.longitude });
  }, [isSheetVisible, mapFocusKey, mapFocusPlace]);

  useEffect(() => {
    Animated.timing(mapExpandAnim, {
      toValue: isMapExpanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isMapExpanded, mapExpandAnim]);

  useEffect(() => {
    Animated.timing(bubbleAnim, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [bubbleAnim]);

  const mapHeight = mapExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [184, Math.max(360, Math.round(windowHeight * 0.68))],
  });

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <View style={styles.layout}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <View style={styles.timiCenter}>
              <TimiAnimated
                status={status}
                size={112}
                mood={timiMood}
                interaction={timiInteraction}
                signal={timiSignal}
              />
              <Animated.View
                style={[
                  styles.questionBubble,
                  {
                    opacity: bubbleAnim,
                    transform: [
                      {
                        translateY: bubbleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.questionText}>오늘 몇 시까지 도착해야 하나요?</Text>
              </Animated.View>
            </View>
          </View>

          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>즉시 설정</Text>

            <Pressable onPress={onOpenOriginSheet} style={({ pressed }) => [styles.fieldRow, { opacity: pressed ? 0.92 : 1 }]}> 
              <Text style={styles.fieldLabel}>출발지</Text>
              <Text style={styles.fieldValue}>{origin}</Text>
            </Pressable>

            <Pressable onPress={onOpenDestinationSheet} style={({ pressed }) => [styles.fieldRow, { opacity: pressed ? 0.92 : 1 }]}> 
              <Text style={styles.fieldLabel}>도착지</Text>
              <Text style={styles.fieldValue}>{hasDestination ? destination : '어디로 가시나요?'}</Text>
            </Pressable>

            <Pressable
              onPress={onOpenTimePicker}
              style={({ pressed }) => [
                styles.timeSection,
                status === 'relaxed' ? styles.timeSectionRelaxed : null,
                { opacity: pressed ? 0.94 : 1 },
              ]}
            >
              <View style={styles.arrivalHeader}>
                <StatusBadge status={status} label={statusLabel} size="sm" />
              </View>
              {arrivalAt ? (
                <>
                  <TimeDisplay label="도착 목표 시간" time={arrivalAt} emphasize size="hero" centered />
                  <Text style={styles.timeHint}>{headline}</Text>
                </>
              ) : (
                <View style={styles.timePlaceholderWrap}>
                  <Text style={styles.timePlaceholderTitle}>도착 목표 시간을 설정해주세요</Text>
                  <Text style={styles.timePlaceholderBody}>눌러서 시간을 선택하면 바로 반영돼요.</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>최근 목적지</Text>
            {recentPlaces.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>최근 목적지가 없습니다</Text>
                <Text style={styles.emptyBody}>목적지를 선택하면 자동으로 여기에 표시됩니다.</Text>
              </View>
            ) : (
              <View style={styles.quickList}>
                {recentPlaces.slice(0, 3).map((place) => (
                  <PlaceQuickRow key={place.id} place={place} onPress={() => onPressRecentApply(place.id)} />
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>저장된 장소</Text>
            {savedPlaces.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>저장된 장소가 없습니다</Text>
                <Text style={styles.emptyBody}>자주 가는 장소를 저장해보세요.</Text>
              </View>
            ) : (
              <View style={styles.quickList}>
                {savedPlaces.map((place) => (
                  <PlaceQuickRow key={place.id} place={place} onPress={() => onPressSavedApply(place.id)} />
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>루틴</Text>
            <View style={styles.quickList}>
              {routinePreview.map((item) => (
                <ListItemCard key={item.id} title={item.title} subtitle={item.hint} dense onPress={onPressRoutines} />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.ctaWrap}>
          <BottomCTA label={cta || '출발 시간 맞추기'} status={status} onPress={onPressTransit} />
        </View>
      </View>

      <BottomSheet
        visible={isSheetVisible}
        onClose={onCloseSheet}
        title={activeField === 'origin' ? '출발지 선택' : '도착지 선택'}
      >
        <TextInput
          value={sheetQuery}
          onChangeText={onChangeSheetQuery}
          placeholder="장소명 또는 주소 검색"
          placeholderTextColor={uiTheme.colors.textSecondary}
          style={styles.sheetInput}
        />

        <View style={styles.mapSection}>
          <View style={styles.mapHeaderRow}>
            <Text style={styles.sheetTitle}>지도 선택</Text>
            <Pressable onPress={onToggleMapExpand} style={({ pressed }) => [styles.mapExpandButton, { opacity: pressed ? 0.9 : 1 }]}> 
              <Text style={styles.mapExpandButtonText}>{isMapExpanded ? '지도 축소' : '지도 확대'}</Text>
            </Pressable>
          </View>

          <Animated.View style={[styles.mapFrame, { height: mapHeight }]}>
            {KAKAO_JAVASCRIPT_KEY ? (
              <KakaoMapWebView
                ref={mapRef}
                apiKey={KAKAO_JAVASCRIPT_KEY}
                initialCenter={{ lat: mapFocusPlace?.latitude ?? 37.5665, lng: mapFocusPlace?.longitude ?? 126.978 }}
                initialMarker={{ lat: mapFocusPlace?.latitude ?? 37.5665, lng: mapFocusPlace?.longitude ?? 126.978 }}
                onEvent={(event: KakaoMapWebViewEvent) => {
                  if (event.type === 'MAP_MOVED') {
                    onMapCenterChange({ lat: event.lat, lng: event.lng, address: event.address });
                  }
                }}
                style={styles.mapWebview}
              />
            ) : (
              <View style={styles.mapFallback}>
                <Text style={styles.mapFallbackText}>지도 키가 없어 지도를 표시할 수 없습니다.</Text>
              </View>
            )}

            <View pointerEvents="none" style={styles.centerPointerWrap}>
              <View style={styles.centerPointer} />
            </View>
          </Animated.View>

          <View style={styles.mapFooter}>
            <Text numberOfLines={1} style={styles.mapCenterText}>{mapCenterLabel}</Text>
            <Pressable
              onPress={onConfirmMapCenter}
              disabled={isSheetClosing}
              style={({ pressed }) => [styles.confirmMapButton, { opacity: isSheetClosing ? 0.6 : pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.confirmMapButtonText}>이 위치로 선택</Text>
            </Pressable>
          </View>
        </View>

        {!isMapExpanded ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetTitle}>검색 결과</Text>
            {filteredPlaces.map((place) => (
              <PlaceQuickRow
                key={place.id}
                place={place}
                selected={selectedFeedbackId === place.id}
                disabled={isSheetClosing}
                onPress={() => onSelectSearchPlace(place)}
              />
            ))}
          </View>
        ) : null}

        {!isMapExpanded ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetTitle}>최근 검색</Text>
            {recentPlaces.length === 0 ? (
              <Text style={styles.sheetEmpty}>최근 검색이 없습니다</Text>
            ) : (
              recentPlaces.slice(0, 3).map((place) => (
                <PlaceQuickRow
                  key={place.id}
                  place={place}
                  selected={selectedFeedbackId === place.id}
                  disabled={isSheetClosing}
                  onPress={() => onSelectRecentPlace(place.id)}
                />
              ))
            )}
          </View>
        ) : null}

        {!isMapExpanded ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetTitle}>저장된 장소</Text>
            {savedPlaces.length === 0 ? (
              <Text style={styles.sheetEmpty}>저장된 장소가 없습니다</Text>
            ) : (
              savedPlaces.map((place) => (
                <PlaceQuickRow
                  key={place.id}
                  place={place}
                  selected={selectedFeedbackId === place.id}
                  disabled={isSheetClosing}
                  onPress={() => onSelectSavedPlace(place.id)}
                />
              ))
            )}
          </View>
        ) : null}

        {latestSelectedPlace ? (
          <View style={styles.sheetSection}>
            <Text style={styles.sheetTitle}>장소 저장</Text>
            <Text style={styles.sheetHint}>선택된 위치: {latestSelectedPlace.address}</Text>
            {!isSaveNameOpen ? (
              <Pressable onPress={onOpenSaveName} style={({ pressed }) => [styles.saveButton, { opacity: pressed ? 0.9 : 1 }]}> 
                <Text style={styles.saveButtonText}>이 장소 저장하기</Text>
              </Pressable>
            ) : (
              <View style={styles.saveInputWrap}>
                <TextInput
                  value={saveName}
                  onChangeText={onChangeSaveName}
                  placeholder="예: 집, 회사, 헬스장"
                  placeholderTextColor={uiTheme.colors.textSecondary}
                  style={styles.saveInput}
                />
                <View style={styles.saveActionRow}>
                  <Pressable onPress={onCancelSaveName} style={({ pressed }) => [styles.saveGhost, { opacity: pressed ? 0.9 : 1 }]}> 
                    <Text style={styles.saveGhostText}>취소</Text>
                  </Pressable>
                  <Pressable onPress={onSavePlace} style={({ pressed }) => [styles.savePrimary, { opacity: pressed ? 0.9 : 1 }]}> 
                    <Text style={styles.savePrimaryText}>저장</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={isTimePickerVisible} onClose={onCancelTimePicker} title="도착 시간 선택">
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="spinner"
          is24Hour
          onChange={onChangeArrivalTime}
          style={styles.timePicker}
        />
        <View style={styles.timeActionRow}>
          <Pressable onPress={onCancelTimePicker} style={({ pressed }) => [styles.timeCancel, { opacity: pressed ? 0.9 : 1 }]}> 
            <Text style={styles.timeCancelText}>취소</Text>
          </Pressable>
          <Pressable onPress={onConfirmTimePicker} style={({ pressed }) => [styles.timeConfirm, { opacity: pressed ? 0.9 : 1 }]}> 
            <Text style={styles.timeConfirmText}>확인</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: uiTheme.spacing.s8,
  },
  layout: {
    flex: 1,
    gap: uiTheme.spacing.s12,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    gap: uiTheme.spacing.s20,
    paddingBottom: uiTheme.spacing.s8,
  },
  topSection: {
    gap: uiTheme.spacing.s8,
  },
  timiCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.s8,
  },
  questionBubble: {
    borderRadius: uiTheme.radius.large,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s16,
    paddingVertical: uiTheme.spacing.s12,
  },
  questionText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: uiTheme.colors.textPrimary,
    textAlign: 'center',
  },
  controlCard: {
    borderRadius: uiTheme.radius.large,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s16,
    paddingVertical: uiTheme.spacing.s16,
    gap: uiTheme.spacing.s12,
  },
  controlTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  fieldRow: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s4,
  },
  fieldLabel: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  fieldValue: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '500',
  },
  timeSection: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s8,
    alignItems: 'center',
  },
  timeSectionRelaxed: {
    borderColor: uiTheme.colors.primaryMint,
    backgroundColor: '#EEF9F8',
  },
  arrivalHeader: {
    alignSelf: 'flex-start',
  },
  timeHint: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
    textAlign: 'center',
  },
  timePlaceholderWrap: {
    minHeight: 132,
    justifyContent: 'center',
    alignItems: 'center',
    gap: uiTheme.spacing.s8,
    paddingHorizontal: uiTheme.spacing.s16,
  },
  timePlaceholderTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePlaceholderBody: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
    textAlign: 'center',
  },
  sectionGroup: {
    gap: uiTheme.spacing.s12,
  },
  sectionTitle: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  quickList: {
    gap: uiTheme.spacing.s8,
  },
  placeRow: {
    minHeight: 64,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.s8,
  },
  placeRowSelected: {
    borderColor: uiTheme.colors.primaryMint,
    backgroundColor: '#EEF9F8',
  },
  placeIconWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeTextWrap: {
    flex: 1,
    gap: uiTheme.spacing.s4,
  },
  placeTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  placeSubtitle: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  emptyCard: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s4,
  },
  emptyTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '500',
  },
  emptyBody: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  ctaWrap: {
    paddingTop: uiTheme.spacing.s8,
  },
  sheetInput: {
    minHeight: 48,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
  },
  mapSection: {
    gap: uiTheme.spacing.s8,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapExpandButton: {
    minHeight: 30,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    paddingHorizontal: uiTheme.spacing.s8,
    justifyContent: 'center',
    backgroundColor: uiTheme.colors.card,
  },
  mapExpandButtonText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  mapFrame: {
    height: 184,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    overflow: 'hidden',
    backgroundColor: uiTheme.colors.background,
  },
  mapWebview: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  centerPointerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPointer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: uiTheme.colors.primaryMint,
    backgroundColor: '#FFFFFFCC',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.s8,
  },
  mapCenterText: {
    flex: 1,
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  confirmMapButton: {
    minHeight: 36,
    borderRadius: uiTheme.radius.medium,
    backgroundColor: uiTheme.colors.primaryMint,
    paddingHorizontal: uiTheme.spacing.s12,
    justifyContent: 'center',
  },
  confirmMapButtonText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  sheetSection: {
    gap: uiTheme.spacing.s8,
  },
  sheetTitle: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  sheetEmpty: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  sheetHint: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  saveButton: {
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    backgroundColor: uiTheme.colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...uiTheme.typography.button,
    color: uiTheme.colors.textPrimary,
  },
  saveInputWrap: {
    gap: uiTheme.spacing.s8,
  },
  saveInput: {
    minHeight: 44,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.card,
    paddingHorizontal: uiTheme.spacing.s12,
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
  },
  saveActionRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.s8,
  },
  saveGhost: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveGhostText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  savePrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: uiTheme.colors.primaryBlue,
  },
  savePrimaryText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  timePicker: {
    alignSelf: 'center',
    height: 160,
  },
  timeActionRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.s8,
  },
  timeCancel: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCancelText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  timeConfirm: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    backgroundColor: uiTheme.colors.primaryMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeConfirmText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
});
