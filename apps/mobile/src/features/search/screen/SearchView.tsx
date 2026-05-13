import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { HomeTabBar, TimeWheelPicker } from '../../../components/home';
import { KakaoMapCrossPlatform } from '../../map/components/KakaoMapCrossPlatform';
import type { LocationField, SavedPlace } from '../../commute-state/context';
import type { MapCenterSource } from '../../map/webview/types';

type SearchDestinationCard = SavedPlace & { previewTime: string };

type MapCenterState = {
  lat: number;
  lng: number;
  address: string;
  source: MapCenterSource;
  accuracy?: number;
};

export interface SearchViewProps {
  activeField: LocationField;
  arrivalAt: string;
  recentDestinations: SearchDestinationCard[];
  originInput: string;
  destinationInput: string;
  fieldSuggestions: SavedPlace[];
  isSearchingFieldSuggestions: boolean;
  isSettingCurrentOrigin: boolean;
  mapQuery: string;
  mapSearchResults: SavedPlace[];
  isSearchingMap: boolean;
  mapCenter: MapCenterState;
  hasOriginConfigured: boolean;
  hasDestinationConfigured: boolean;
  originMarker: { lat: number; lng: number } | null;
  kakaoJsKey: string;
  onSelectField: (field: LocationField) => void;
  onChangeArrivalAt: (next: string) => void;
  onChangeOriginInput: (text: string) => void;
  onChangeDestinationInput: (text: string) => void;
  onBlurField: (field: LocationField, typedText?: string) => void;
  onChangeMapQuery: (text: string) => void;
  onSelectMapResult: (place: SavedPlace) => void;
  onPrepareSelectSuggestion: (field: LocationField) => void;
  onSelectRecentDestination: (place: SavedPlace) => void;
  onMapCenterChange: (next: MapCenterState) => void;
  onGeocodeResult: (info: {
    lat: number;
    lng: number;
    roadAddress: string | null;
    jibunAddress: string | null;
    representativeJibun: string | null;
  }) => void;
  onApplyMapCenter: () => void;
  onPressUseCurrentOrigin: () => void;
  onPressRecommendation: () => void;
  onClose: () => void;
}

function toMeridiemClock(value: string) {
  const [h, m] = value.split(':');
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return '19:00';
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function DestinationPin({ size = 34 }: { size?: number }) {
  const h = Math.round(size * 1.22);
  return (
    <Svg width={size} height={h} viewBox="0 0 34 42">
      <Path
        d="M17 1C8.7 1 2 7.7 2 16c0 11.1 12.2 22.1 14.1 23.8a1.4 1.4 0 0 0 1.8 0C19.8 38.1 32 27.1 32 16 32 7.7 25.3 1 17 1z"
        fill="#E94A46"
        stroke="#B8312F"
        strokeWidth="1.2"
      />
      <Circle cx="17" cy="16" r="6.2" fill="#fff" />
      <Circle cx="17" cy="16" r="2.8" fill="#E94A46" />
    </Svg>
  );
}

export function SearchView(props: SearchViewProps) {
  const {
    activeField,
    arrivalAt,
    recentDestinations,
    originInput,
    destinationInput,
    fieldSuggestions,
    isSearchingFieldSuggestions,
    isSettingCurrentOrigin,
    mapSearchResults,
    isSearchingMap,
    mapCenter,
    hasOriginConfigured,
    hasDestinationConfigured,
    originMarker,
    kakaoJsKey,
    onSelectField,
    onChangeArrivalAt,
    onChangeOriginInput,
    onChangeDestinationInput,
    onBlurField,
    onChangeMapQuery,
    onSelectMapResult,
    onPrepareSelectSuggestion,
    onSelectRecentDestination,
    onMapCenterChange,
    onGeocodeResult,
    onApplyMapCenter,
    onPressUseCurrentOrigin,
    onPressRecommendation,
    onClose,
  } = props;

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isOriginSuggestionExpanded, setIsOriginSuggestionExpanded] = useState(false);
  const [isDestinationSuggestionExpanded, setIsDestinationSuggestionExpanded] = useState(false);
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isMapResultsExpanded, setIsMapResultsExpanded] = useState(false);
  const [pendingMapRecommendationRefresh, setPendingMapRecommendationRefresh] = useState(false);
  const [localOrigin, setLocalOrigin] = useState(originInput);
  const [localDestination, setLocalDestination] = useState(destinationInput);
  const [visibleCandidates, setVisibleCandidates] = useState<SavedPlace[]>([]);

  const hasSuggestionDropdown = isSearchingFieldSuggestions || fieldSuggestions.length > 0;
  const isSuggestionOpen =
    hasSuggestionDropdown &&
    (activeField === 'origin' ? isOriginSuggestionExpanded : isDestinationSuggestionExpanded);
  const canSearchRoute = localOrigin.trim().length > 0 || localDestination.trim().length > 0;
  const shouldShowDestinationPin = activeField === 'destination' || hasDestinationConfigured;
  const selectionLabel = activeField === 'origin' ? '출발지' : '도착지';
  const mapConfirmLabel = `이 위치를 ${selectionLabel}로 설정`;

  const unifiedCandidates = useMemo(() => mapSearchResults.slice(0, 8), [mapSearchResults]);

  useEffect(() => setLocalOrigin(originInput), [originInput]);
  useEffect(() => setLocalDestination(destinationInput), [destinationInput]);

  useEffect(() => {
    const timer = setTimeout(() => setVisibleCandidates(unifiedCandidates), 380);
    return () => clearTimeout(timer);
  }, [unifiedCandidates, mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    // 지도 위치가 바뀌면, 해당 위치 기준 추천이 새로 로딩될 때까지 닫아둔다.
    setPendingMapRecommendationRefresh(true);
    setIsMapResultsExpanded(false);
  }, [mapCenter.lat, mapCenter.lng]);

  useEffect(() => {
    if (isSearchingMap) {
      setIsMapResultsExpanded(false);
      return;
    }
    if (pendingMapRecommendationRefresh && visibleCandidates.length > 0) {
      setIsMapResultsExpanded(true);
      setPendingMapRecommendationRefresh(false);
    }
  }, [isSearchingMap, visibleCandidates.length, pendingMapRecommendationRefresh]);

  const mapNode = (
    <View
      style={styles.mapTouchGuard}
      onTouchStart={() => setIsScrollEnabled(false)}
      onTouchEnd={() => setIsScrollEnabled(true)}
      onTouchCancel={() => setIsScrollEnabled(true)}
    >
      <KakaoMapCrossPlatform
        jsApiKey={kakaoJsKey}
        center={{
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          address: mapCenter.address,
          source: mapCenter.source,
        }}
        originMarker={originMarker}
        onCenterChange={(next) => {
          const source = next.source ?? 'user';
          onMapCenterChange({
            lat: next.lat,
            lng: next.lng,
            address: next.address ?? mapCenter.address,
            source,
            accuracy: next.accuracy ?? mapCenter.accuracy,
          });
        }}
        onGeocodeResult={onGeocodeResult}
        style={styles.map}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="searchBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#DEFFFE" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#F8F8FF" stopOpacity="0.92" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#searchBgGradient)" />
        </Svg>

        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={isScrollEnabled}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="arrow-back-outline" size={26} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.headerTitle}>경로 검색</Text>
            </View>

            <View style={styles.fieldCardWrap}>
              <View style={styles.fieldCard}>
                <TextInput
                  value={localOrigin}
                  onFocus={() => {
                    onSelectField('origin');
                    onChangeMapQuery(localOrigin);
                    setIsOriginSuggestionExpanded(true);
                  }}
                  onBlur={() => {
                    onChangeOriginInput(localOrigin);
                    onBlurField('origin', localOrigin);
                  }}
                  onChangeText={(text) => {
                    setLocalOrigin(text);
                    onChangeOriginInput(text);
                    onChangeMapQuery(text);
                    onSelectField('origin');
                    setIsOriginSuggestionExpanded(true);
                  }}
                  placeholder="출발지 입력"
                  placeholderTextColor="#6F8F90"
                  style={styles.fieldInput}
                />
                <Pressable
                  onPress={onPressUseCurrentOrigin}
                  disabled={isSettingCurrentOrigin}
                  style={({ pressed }) => [
                    styles.currentLocationButton,
                    { opacity: isSettingCurrentOrigin ? 0.65 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons
                    name={isSettingCurrentOrigin ? 'sync-outline' : 'locate-outline'}
                    size={17}
                    color="#0E2C2C"
                  />
                </Pressable>
                <Pressable
                  onPress={() => {
                    onSelectField('origin');
                    setIsOriginSuggestionExpanded((prev) => !prev);
                  }}
                  style={({ pressed }) => [
                    styles.suggestionToggleButton,
                    styles.suggestionToggleButtonOrigin,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons
                    name={
                      hasSuggestionDropdown && isOriginSuggestionExpanded
                        ? 'chevron-up-outline'
                        : 'chevron-down-outline'
                    }
                    size={18}
                    color="#0E2C2C"
                  />
                </Pressable>

                <View style={styles.divider} />

                <TextInput
                  value={localDestination}
                  onFocus={() => {
                    onSelectField('destination');
                    onChangeMapQuery(localDestination);
                    setIsDestinationSuggestionExpanded(true);
                  }}
                  onBlur={() => {
                    onChangeDestinationInput(localDestination);
                    onBlurField('destination', localDestination);
                  }}
                  onChangeText={(text) => {
                    setLocalDestination(text);
                    onChangeDestinationInput(text);
                    onChangeMapQuery(text);
                    onSelectField('destination');
                    setIsDestinationSuggestionExpanded(true);
                  }}
                  placeholder="도착지 입력"
                  placeholderTextColor="#6F8F90"
                  style={[styles.fieldInput, styles.fieldInputBottom]}
                />
                <Pressable
                  onPress={() => {
                    onSelectField('destination');
                    setIsDestinationSuggestionExpanded((prev) => !prev);
                  }}
                  style={({ pressed }) => [
                    styles.suggestionToggleButton,
                    styles.suggestionToggleButtonDestination,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons
                    name={
                      hasSuggestionDropdown && isDestinationSuggestionExpanded
                        ? 'chevron-up-outline'
                        : 'chevron-down-outline'
                    }
                    size={18}
                    color="#0E2C2C"
                  />
                </Pressable>
              </View>

              {isSearchingFieldSuggestions && isSuggestionOpen ? (
                <View style={styles.fieldSuggestionDropdown}>
                  <Text style={styles.fieldSuggestionHint}>추천 장소를 불러오는 중...</Text>
                </View>
              ) : null}

              {!isSearchingFieldSuggestions && isSuggestionOpen && fieldSuggestions.length > 0 ? (
                <View style={styles.fieldSuggestionDropdown}>
                  {fieldSuggestions.slice(0, 5).map((place, index) => (
                    <Pressable
                      key={`${place.id}-${index}`}
                      onPressIn={() => onPrepareSelectSuggestion(activeField)}
                      onPress={() => {
                        onSelectMapResult(place);
                        if (activeField === 'origin') setIsOriginSuggestionExpanded(false);
                        else setIsDestinationSuggestionExpanded(false);
                      }}
                      style={({ pressed }) => [
                        styles.fieldSuggestionItem,
                        { opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <Text style={styles.fieldSuggestionName}>{place.name}</Text>
                      <Text style={styles.fieldSuggestionAddress} numberOfLines={1}>
                        {place.address}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() => setTimePickerVisible(true)}
              style={({ pressed }) => [styles.arrivalCard, { opacity: pressed ? 0.94 : 1 }]}
            >
              <Text style={styles.arrivalLabel}>도착시간 우선</Text>
              <Text style={styles.arrivalValue}>{toMeridiemClock(arrivalAt)}</Text>
              <Ionicons name="time-outline" size={24} color="#58C7C2" />
            </Pressable>
            <View style={styles.arrivalSupportRow}>
              <Ionicons name="flag-outline" size={14} color="#5A7A7B" />
              <Text style={styles.arrivalSupportText}>
                모든 추천은 도착시간 기준으로 정렬됩니다.
              </Text>
            </View>

            <View style={styles.mapSection}>
              <View style={styles.mapHeaderRow}>
                <Text style={styles.mapTitle}>지도에서 선택</Text>
                <View style={styles.fieldModeGroup}>
                  <Pressable
                    onPress={() => onSelectField('origin')}
                    style={[
                      styles.fieldModeButton,
                      activeField === 'origin' ? styles.fieldModeButtonActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldModeButtonText,
                        activeField === 'origin' ? styles.fieldModeButtonTextActive : null,
                      ]}
                    >
                      출발지 선택
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onSelectField('destination')}
                    style={[
                      styles.fieldModeButton,
                      activeField === 'destination' ? styles.fieldModeButtonActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldModeButtonText,
                        activeField === 'destination' ? styles.fieldModeButtonTextActive : null,
                      ]}
                    >
                      도착지 선택
                    </Text>
                  </Pressable>
                </View>
              </View>
              {!hasDestinationConfigured ? (
                <Text style={styles.mapGuideText}>
                  도착지를 먼저 설정해주세요.
                </Text>
              ) : null}
              {!hasOriginConfigured ? (
                <Text style={styles.mapGuideText}>출발지는 현재 위치를 쓰거나 직접 선택할 수 있어요.</Text>
              ) : null}

              {isSearchingMap ? (
                <Text style={styles.searchingText}>위치 추천 갱신 중...</Text>
              ) : null}

              <View style={styles.mapWrap}>
                {kakaoJsKey ? (
                  <View style={styles.mapCanvasWrap}>
                    {mapNode}
                    {shouldShowDestinationPin ? (
                      <View pointerEvents="none" style={styles.mapPinOverlay}>
                        <DestinationPin size={34} />
                      </View>
                    ) : null}
                    {!hasOriginConfigured && !hasDestinationConfigured ? (
                      <View pointerEvents="none" style={styles.mapCenterOverlay}>
                        <Text style={styles.mapCenterOverlayText}>
                          출발지 또는 도착지를 선택해주세요
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.mapOverlayActions}>
                      <Pressable
                        onPress={onPressUseCurrentOrigin}
                        style={({ pressed }) => [
                          styles.mapOverlayIconButton,
                          { opacity: pressed ? 0.88 : 1 },
                        ]}
                      >
                        <Ionicons name="locate-outline" size={18} color="#0E2C2C" />
                      </Pressable>
                      <Pressable
                        onPress={() => setIsMapPickerOpen(true)}
                        style={({ pressed }) => [
                          styles.mapOverlayIconButton,
                          { opacity: pressed ? 0.88 : 1 },
                        ]}
                      >
                        <Ionicons name="expand-outline" size={18} color="#0E2C2C" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.mapMissingWrap}>
                    <Text style={styles.mapMissingText}>
                      EXPO_PUBLIC_KAKAO_JS_KEY를 설정하면 지도를 바로 선택할 수 있어요.
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.centerAddress} numberOfLines={1}>
                중심 위치: {mapCenter.address}
              </Text>

              <View style={styles.confirmWrap}>
                <Pressable
                  onPress={onApplyMapCenter}
                  style={({ pressed }) => [styles.mapApplyButton, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Text style={styles.mapApplyButtonText}>{mapConfirmLabel}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setIsMapResultsExpanded((prev) => !prev)}
                style={({ pressed }) => [styles.mapResultToggle, { opacity: pressed ? 0.92 : 1 }]}
              >
                <Text style={styles.mapResultToggleText}>
                  위치 추천 {visibleCandidates.length}개
                </Text>
                <Ionicons
                  name={isMapResultsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color="#0E2C2C"
                />
              </Pressable>

              {isMapResultsExpanded ? (
                <ScrollView
                  style={styles.mapResultList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {visibleCandidates.map((place, index) => {
                    const distanceM = toDistanceMeters(
                      mapCenter.lat,
                      mapCenter.lng,
                      place.latitude,
                      place.longitude,
                    );
                    const near = distanceM <= 700;
                    return (
                      <Pressable
                        key={`${place.id}-${index}`}
                        onPress={() => onSelectMapResult(place)}
                        style={({ pressed }) => [
                          styles.mapResultItem,
                          { opacity: pressed ? 0.9 : 1 },
                        ]}
                      >
                        <View style={styles.mapResultTopRow}>
                          <Text style={styles.mapResultName}>{place.name}</Text>
                          <View style={styles.mapResultMetaRow}>
                            {near ? (
                              <View style={styles.nearbyBadge}>
                                <Text style={styles.nearbyBadgeText}>현재 지도 근처</Text>
                              </View>
                            ) : null}
                            <Text style={styles.distanceText}>{Math.round(distanceM)}m</Text>
                          </View>
                        </View>
                        <Text style={styles.mapResultAddress} numberOfLines={1}>
                          {place.address}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            <View style={styles.recentWrap}>
              <Pressable
                onPress={() => setIsRecentExpanded((prev) => !prev)}
                style={({ pressed }) => [styles.recentHeaderRow, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.recentTitle}>최근 목적지</Text>
                <View style={styles.recentHeaderAction}>
                  {!isRecentExpanded ? <Text style={styles.recentMoreText}>더보기</Text> : null}
                  <Ionicons
                    name={isRecentExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                    color="#0E2C2C"
                  />
                </View>
              </Pressable>
              {isRecentExpanded
                ? recentDestinations.map((place, index) => (
                    <Pressable
                      key={`${place.id}-${index}`}
                      onPress={() => onSelectRecentDestination(place)}
                      style={({ pressed }) => [styles.recentCard, { opacity: pressed ? 0.92 : 1 }]}
                    >
                      <View style={styles.recentIconWrap}>
                        <Ionicons name="location-outline" size={24} color="#0E2C2C" />
                      </View>
                      <View style={styles.recentInfo}>
                        <Text style={styles.recentName}>{place.name}</Text>
                        <Text style={styles.recentHint}>자주가는 곳</Text>
                      </View>
                      <Text style={styles.recentTime}>{place.previewTime}</Text>
                    </Pressable>
                  ))
                : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View pointerEvents="box-none" style={styles.floatingCtaWrap}>
          <Pressable
            onPress={() => {
              onChangeOriginInput(localOrigin);
              onBlurField('origin', localOrigin);
              onChangeDestinationInput(localDestination);
              onBlurField('destination', localDestination);
              onPressRecommendation();
            }}
            style={({ pressed }) => [
              styles.searchButton,
              !canSearchRoute ? styles.searchButtonDisabled : null,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            disabled={!canSearchRoute}
          >
            <Text style={styles.searchButtonText}>경로 검색</Text>
          </Pressable>
        </View>

        <HomeTabBar status="relaxed" />

        {isMapPickerOpen ? (
          <View style={styles.mapPickerOverlay}>
            <View style={styles.mapPickerHeader}>
              <Text style={styles.mapPickerTitle}>지도에서 위치 선택</Text>
              <Pressable
                onPress={() => {
                  setIsMapPickerOpen(false);
                  setIsScrollEnabled(true);
                }}
                style={({ pressed }) => [styles.mapPickerClose, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="close" size={20} color="#0E2C2C" />
              </Pressable>
            </View>
            <View
              style={styles.mapPickerCanvas}
              onTouchStart={() => setIsScrollEnabled(false)}
              onTouchEnd={() => setIsScrollEnabled(true)}
              onTouchCancel={() => setIsScrollEnabled(true)}
            >
              {mapNode}
              {shouldShowDestinationPin ? (
                <View pointerEvents="none" style={styles.mapPickerPinOverlay}>
                  <DestinationPin size={34} />
                </View>
              ) : null}
            </View>
            <View style={styles.mapPickerBottomSheet}>
              <Text style={styles.mapPickerAddress} numberOfLines={1}>
                중심 위치: {mapCenter.address}
              </Text>
              <Pressable
                onPress={() => {
                  onApplyMapCenter();
                  setIsMapPickerOpen(false);
                  setIsScrollEnabled(true);
                }}
                style={({ pressed }) => [styles.mapApplyButton, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={styles.mapApplyButtonText}>{mapConfirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <TimeWheelPicker
        visible={timePickerVisible}
        initialTime={arrivalAt}
        accentColor="#58C7C2"
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(time) => {
          onChangeArrivalAt(time);
          setTimePickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7F8' },
  screen: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 220, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  headerTitle: { fontFamily: 'Pretendard-ExtraBold', fontSize: 30, color: '#0D2B2A' },
  fieldCardWrap: { position: 'relative', zIndex: 20 },
  fieldCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#58C7C2',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 5,
  },
  fieldInput: {
    minHeight: 58,
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#0E2C2C',
    paddingHorizontal: 24,
    paddingRight: 104,
  },
  fieldInputBottom: { borderTopWidth: 1, borderTopColor: '#58C7C2' },
  divider: { height: 1, backgroundColor: '#58C7C2' },
  fieldSuggestionDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#CDEDEC',
    overflow: 'hidden',
    zIndex: 30,
  },
  fieldSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F7F6',
  },
  fieldSuggestionName: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#0E2C2C' },
  fieldSuggestionAddress: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#6F8F90',
  },
  fieldSuggestionHint: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#6F8F90',
  },
  suggestionToggleButton: {
    position: 'absolute',
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    backgroundColor: 'rgba(88,199,194,0.2)',
  },
  suggestionToggleButtonOrigin: { top: 17 },
  suggestionToggleButtonDestination: { top: 76 },
  currentLocationButton: {
    position: 'absolute',
    right: 40,
    top: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E4FAF8',
    borderWidth: 1,
    borderColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  arrivalCard: {
    minHeight: 84,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#58C7C2',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 13,
    elevation: 5,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrivalLabel: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#6F8F90', marginRight: 14 },
  arrivalValue: { flex: 1, fontFamily: 'Pretendard-ExtraBold', fontSize: 34, color: '#0D2B2A' },
  arrivalSupportRow: {
    marginTop: -6,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  arrivalSupportText: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#5A7A7B' },
  mapSection: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapTitle: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#0E2C2C' },
  fieldModeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldModeButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F3F5F7',
  },
  fieldModeButtonActive: {
    backgroundColor: '#E9FAF8',
  },
  fieldModeButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 11,
    color: '#5F7076',
  },
  fieldModeButtonTextActive: {
    color: '#1A8A85',
  },
  mapGuideText: {
    marginTop: -2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#5A7A7B',
  },
  mapQueryInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE8E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#0E2C2C',
  },
  searchingText: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#6F8F90' },
  mapResultToggle: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#EFF7F8',
    borderWidth: 1,
    borderColor: '#D7E7E8',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapResultToggleText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#0E2C2C' },
  mapResultList: { maxHeight: 198 },
  mapResultItem: {
    borderRadius: 10,
    backgroundColor: '#F4FBFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  mapResultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapResultName: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#0E2C2C' },
  mapResultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nearbyBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#DFF7F5',
  },
  nearbyBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 10, color: '#168982' },
  distanceText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#6F8F90' },
  mapResultAddress: {
    marginTop: 2,
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#6F8F90',
  },
  mapWrap: {
    height: 210,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BFE8E5',
  },
  mapCanvasWrap: { flex: 1 },
  mapTouchGuard: { flex: 1 },
  map: { flex: 1 },
  mapPinOverlay: { position: 'absolute', left: '50%', top: '50%', marginLeft: -17, marginTop: -41 },
  mapCenterOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    transform: [{ translateY: -16 }],
    borderRadius: 999,
    backgroundColor: 'rgba(14,44,44,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapCenterOverlayText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  mapMissingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF7',
    paddingHorizontal: 16,
  },
  mapMissingText: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#48656A',
  },
  centerAddress: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#6F8F90' },
  mapOverlayActions: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 8,
  },
  mapOverlayIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#D7E7E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmWrap: {
    marginTop: 2,
  },
  mapApplyButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#46B8B2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#46B8B2',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  mapApplyButtonText: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#FFFFFF' },
  recentWrap: { gap: 12 },
  recentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentMoreText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#6F8F90' },
  recentTitle: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#0E2C2C' },
  recentCard: {
    minHeight: 90,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  recentIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#58C7C2',
    backgroundColor: 'rgba(88,199,194,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: { flex: 1 },
  recentName: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#0D2B2A' },
  recentHint: { marginTop: 4, fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#6F8F90' },
  recentTime: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#0D2B2A' },
  floatingCtaWrap: { position: 'absolute', left: 20, right: 20, bottom: 108 },
  mapPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5F7F8',
    zIndex: 120,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  mapPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapPickerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#0E2C2C' },
  mapPickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E9F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerCanvas: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CDE5E6',
  },
  mapPickerSearchOverlay: { position: 'absolute', top: 10, left: 10, right: 10, zIndex: 5 },
  mapPickerSearchInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFE4E5',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#0E2C2C',
  },
  mapPickerPinOverlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -17,
    marginTop: -41,
  },
  mapPickerBottomSheet: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDEDEF',
    padding: 12,
    gap: 8,
  },
  mapPickerAddress: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#5F7779' },
  searchButton: {
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
  searchButtonDisabled: { backgroundColor: '#9BC8C5', shadowOpacity: 0.2 },
  searchButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#FFFFFF' },
});
