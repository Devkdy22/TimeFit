import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { HomeTabBar, TimeWheelPicker } from '../../../components/home';
import { KakaoMapCrossPlatform } from '../../map/components/KakaoMapCrossPlatform';
import type { LocationField, SavedPlace } from '../../commute-state/context';
import type { MapCenterSource } from '../../map/webview/types';

type SearchDestinationCard = SavedPlace & {
  previewTime: string;
};

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
  mapQuery: string;
  mapSearchResults: SavedPlace[];
  isSearchingMap: boolean;
  mapCenter: MapCenterState;
  kakaoJsKey: string;
  onSelectField: (field: LocationField) => void;
  onChangeArrivalAt: (next: string) => void;
  onChangeOriginInput: (text: string) => void;
  onChangeDestinationInput: (text: string) => void;
  onBlurField: (field: LocationField) => void;
  onChangeMapQuery: (text: string) => void;
  onSelectMapResult: (place: SavedPlace) => void;
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
  onPressRecommendation: () => void;
  onClose: () => void;
}

function toMeridiemClock(value: string) {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return '19:00';
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function SearchView({
  activeField,
  arrivalAt,
  recentDestinations,
  originInput,
  destinationInput,
  fieldSuggestions,
  isSearchingFieldSuggestions,
  mapQuery,
  mapSearchResults,
  isSearchingMap,
  mapCenter,
  kakaoJsKey,
  onSelectField,
  onChangeArrivalAt,
  onChangeOriginInput,
  onChangeDestinationInput,
  onBlurField,
  onChangeMapQuery,
  onSelectMapResult,
  onSelectRecentDestination,
  onMapCenterChange,
  onGeocodeResult,
  onApplyMapCenter,
  onPressRecommendation,
  onClose,
}: SearchViewProps) {
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isOriginSuggestionExpanded, setIsOriginSuggestionExpanded] = useState(true);
  const [isDestinationSuggestionExpanded, setIsDestinationSuggestionExpanded] = useState(true);
  const [localOrigin, setLocalOrigin] = useState(originInput);
  const [localDestination, setLocalDestination] = useState(destinationInput);
  const hasSuggestionDropdown = isSearchingFieldSuggestions || fieldSuggestions.length > 0;
  const isSuggestionOpen =
    hasSuggestionDropdown &&
    (activeField === 'origin' ? isOriginSuggestionExpanded : isDestinationSuggestionExpanded);

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
            removeClippedSubviews={false}
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
                onBlur={() => {
                  onChangeOriginInput(localOrigin);
                  onBlurField('origin');
                }}
                onChangeText={(text) => {
                  setLocalOrigin(text);
                }}
                selectTextOnFocus={false}
                placeholder="출발지 입력"
                placeholderTextColor="#6F8F90"
                style={styles.fieldInput}
              />
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
                onBlur={() => {
                  onChangeDestinationInput(localDestination);
                  onBlurField('destination');
                }}
                onChangeText={(text) => {
                  setLocalDestination(text);
                }}
                selectTextOnFocus={false}
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
                    onPress={() => {
                      onSelectMapResult(place);
                      if (activeField === 'origin') {
                        setIsOriginSuggestionExpanded(false);
                        return;
                      }
                      setIsDestinationSuggestionExpanded(false);
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
            <Text style={styles.arrivalLabel}>도착시간</Text>
            <Text style={styles.arrivalValue}>{toMeridiemClock(arrivalAt)}</Text>
            <Ionicons name="time-outline" size={24} color="#58C7C2" />
          </Pressable>

          <View style={styles.mapSection}>
            <Text style={styles.mapTitle}>지도에서 선택</Text>

            <TextInput
              value={mapQuery}
              onChangeText={onChangeMapQuery}
              placeholder="장소/도로명 검색"
              placeholderTextColor="#6F8F90"
              style={styles.mapQueryInput}
            />

            {isSearchingMap ? (
              <Text style={styles.searchingText}>카카오 지도 검색 중...</Text>
            ) : null}

            <View style={styles.mapResultList}>
              {mapSearchResults.slice(0, 3).map((place, index) => (
                <Pressable
                  key={`${place.id}-${index}`}
                  onPress={() => onSelectMapResult(place)}
                  style={({ pressed }) => [styles.mapResultItem, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Text style={styles.mapResultName}>{place.name}</Text>
                  <Text style={styles.mapResultAddress} numberOfLines={1}>
                    {place.address}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.mapWrap}>
              {kakaoJsKey ? (
                <KakaoMapCrossPlatform
                  jsApiKey={kakaoJsKey}
                  center={{
                    lat: mapCenter.lat,
                    lng: mapCenter.lng,
                    address: mapCenter.address,
                    source: mapCenter.source,
                  }}
                  onCenterChange={(next) => {
                    onMapCenterChange({
                      lat: next.lat,
                      lng: next.lng,
                      address: next.address ?? mapCenter.address,
                      source: next.source ?? 'user',
                      accuracy: next.accuracy ?? mapCenter.accuracy,
                    });
                  }}
                  onGeocodeResult={onGeocodeResult}
                  style={styles.map}
                />
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

            <Pressable
              onPress={onApplyMapCenter}
              style={({ pressed }) => [styles.mapApplyButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.mapApplyButtonText}>
                현재 지도 중심으로 {activeField === 'origin' ? '출발지' : '도착지'} 설정
              </Text>
            </Pressable>
          </View>

          <View style={styles.recentWrap}>
            <Text style={styles.recentTitle}>최근 목적지</Text>
            {recentDestinations.map((place, index) => (
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
            ))}
          </View>

          <Pressable
            onPress={onPressRecommendation}
            style={({ pressed }) => [styles.searchButton, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.searchButtonText}>경로 검색</Text>
          </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        <HomeTabBar status="relaxed" />
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  screen: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 146,
    gap: 14,
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
  headerTitle: {
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 30,
    color: '#0D2B2A',
  },
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
  fieldCardWrap: {
    position: 'relative',
    zIndex: 20,
  },
  fieldInput: {
    minHeight: 58,
    fontFamily: 'Pretendard-Bold',
    fontSize: 16,
    color: '#0E2C2C',
    textAlign: 'left',
    paddingHorizontal: 24,
    paddingRight: 56,
  },
  fieldInputBottom: {
    borderTopWidth: 1,
    borderTopColor: '#58C7C2',
  },
  divider: {
    height: 1,
    backgroundColor: '#58C7C2',
  },
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
    shadowColor: '#0E2C2C',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  suggestionToggleButton: {
    position: 'absolute',
    right: 16,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  suggestionToggleButtonOrigin: {
    top: 14,
  },
  suggestionToggleButtonDestination: {
    bottom: 14,
  },
  fieldSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F7F6',
  },
  fieldSuggestionName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#0E2C2C',
  },
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
  arrivalLabel: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 15,
    color: '#6F8F90',
    marginRight: 14,
  },
  arrivalValue: {
    flex: 1,
    fontFamily: 'Pretendard-ExtraBold',
    fontSize: 34,
    color: '#0D2B2A',
  },
  mapSection: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#1B2A2A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  mapTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#0E2C2C',
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
  searchingText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#6F8F90',
  },
  mapResultList: {
    gap: 6,
  },
  mapResultItem: {
    borderRadius: 10,
    backgroundColor: '#F4FBFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapResultName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#0E2C2C',
  },
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
  map: {
    flex: 1,
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
  centerAddress: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#6F8F90',
  },
  mapApplyButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#58C7C2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapApplyButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  recentWrap: {
    gap: 12,
  },
  recentTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#0E2C2C',
  },
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
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#0D2B2A',
  },
  recentHint: {
    marginTop: 4,
    fontFamily: 'Pretendard-Bold',
    fontSize: 14,
    color: '#6F8F90',
  },
  recentTime: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#0D2B2A',
  },
  searchButton: {
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
  searchButtonText: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
