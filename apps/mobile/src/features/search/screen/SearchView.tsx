import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomCTA, ListItemCard, ScreenContainer, SectionHeader } from '../../../components/ui';
import { uiTheme } from '../../../constants/theme';
import type { LocationField, SavedPlace } from '../../commute-state/context';

export interface SearchViewProps {
  activeField: LocationField;
  origin: string;
  destination: string;
  arrivalAt: string;
  selectedOption: 'fastest' | 'lowTransfer' | 'lowWalk';
  options: ReadonlyArray<{ key: 'fastest' | 'lowTransfer' | 'lowWalk'; label: string }>;
  query: string;
  preview: {
    recommendedDeparture: string;
    estimatedTravel: string;
    buffer: string;
  };
  recentPlaces: SavedPlace[];
  savedPlaces: SavedPlace[];
  filteredSearchResults: SavedPlace[];
  latestSelectedPlace: SavedPlace | null;
  isSaveNameOpen: boolean;
  saveName: string;
  onChangeQuery: (next: string) => void;
  onChangeSaveName: (next: string) => void;
  onSelectField: (field: LocationField) => void;
  onSelectPlace: (place: SavedPlace) => void;
  onSelectMapSample: () => void;
  onOpenSaveName: () => void;
  onSavePlace: () => void;
  onCancelSavePlace: () => void;
  onChangeArrivalAt: (next: string) => void;
  onSelectOption: (key: 'fastest' | 'lowTransfer' | 'lowWalk') => void;
  onPressRecommendation: () => void;
  onClose: () => void;
}

function parseClock(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function shiftClock(value: string, deltaMinutes: number) {
  const minutes = parseClock(value);
  if (minutes == null) {
    return value;
  }
  const next = ((minutes + deltaMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hour = Math.floor(next / 60);
  const minute = next % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function SearchView({
  activeField,
  origin,
  destination,
  arrivalAt,
  selectedOption,
  options,
  query,
  preview,
  recentPlaces,
  savedPlaces,
  filteredSearchResults,
  latestSelectedPlace,
  isSaveNameOpen,
  saveName,
  onChangeQuery,
  onChangeSaveName,
  onSelectField,
  onSelectPlace,
  onSelectMapSample,
  onOpenSaveName,
  onSavePlace,
  onCancelSavePlace,
  onChangeArrivalAt,
  onSelectOption,
  onPressRecommendation,
  onClose,
}: SearchViewProps) {
  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      <SectionHeader title="조건 확정" subtitle="입력과 동시에 결과를 미리 확인하세요" status="warning" actionLabel="닫기" onPressAction={onClose} />

      <ScrollView style={styles.contentArea} contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.conditionPanel}>
          <Text style={styles.sectionTitle}>어디서 어디로 이동하나요?</Text>
          <View style={styles.fieldRow}>
            <Pressable
              onPress={() => onSelectField('origin')}
              style={({ pressed }) => [styles.fieldButton, activeField === 'origin' ? styles.fieldButtonActive : null, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.fieldLabel}>출발지</Text>
              <Text style={styles.fieldValue}>{origin}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSelectField('destination')}
              style={({ pressed }) => [styles.fieldButton, activeField === 'destination' ? styles.fieldButtonActive : null, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.fieldLabel}>도착지</Text>
              <Text style={styles.fieldValue}>{destination}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>도착 시간</Text>
          <View style={styles.arrivalRow}>
            <Pressable onPress={() => onChangeArrivalAt(shiftClock(arrivalAt, -10))} style={({ pressed }) => [styles.arrivalControl, { opacity: pressed ? 0.88 : 1 }]}>
              <Text style={styles.arrivalControlText}>-10분</Text>
            </Pressable>
            <View style={styles.arrivalBadge}>
              <Text style={styles.arrivalText}>{arrivalAt}</Text>
            </View>
            <Pressable onPress={() => onChangeArrivalAt(shiftClock(arrivalAt, 10))} style={({ pressed }) => [styles.arrivalControl, { opacity: pressed ? 0.88 : 1 }]}>
              <Text style={styles.arrivalControlText}>+10분</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.conditionPanel}>
          <Text style={styles.sectionTitle}>주소 검색</Text>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="장소명 또는 주소를 입력하세요"
            placeholderTextColor={uiTheme.colors.textSecondary}
            style={styles.searchInput}
          />
          <View style={styles.resultList}>
            {filteredSearchResults.map((place) => (
              <ListItemCard
                key={place.id}
                title={place.name}
                subtitle={place.address}
                dense
                onPress={() => onSelectPlace(place)}
              />
            ))}
          </View>
        </View>

        <View style={styles.conditionPanel}>
          <Text style={styles.sectionTitle}>지도에서 선택</Text>
          <Pressable onPress={onSelectMapSample} style={({ pressed }) => [styles.mapSelectCard, { opacity: pressed ? 0.9 : 1 }]}> 
            <Text style={styles.mapSelectTitle}>지도 기반 선택 (확장 준비)</Text>
            <Text style={styles.mapSelectSubtitle}>현재는 샘플 지점을 선택하도록 연결되어 있어요.</Text>
          </Pressable>

          {latestSelectedPlace ? (
            <View style={styles.saveArea}>
              <Text style={styles.saveHint}>선택된 위치: {latestSelectedPlace.address}</Text>
              {!isSaveNameOpen ? (
                <Pressable onPress={onOpenSaveName} style={({ pressed }) => [styles.saveButton, { opacity: pressed ? 0.92 : 1 }]}>
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
                    <Pressable onPress={onCancelSavePlace} style={({ pressed }) => [styles.saveActionGhost, { opacity: pressed ? 0.9 : 1 }]}> 
                      <Text style={styles.saveActionGhostText}>취소</Text>
                    </Pressable>
                    <Pressable onPress={onSavePlace} style={({ pressed }) => [styles.saveActionPrimary, { opacity: pressed ? 0.9 : 1 }]}> 
                      <Text style={styles.saveActionPrimaryText}>저장</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.conditionPanel}>
          <Text style={styles.sectionTitle}>최근 검색</Text>
          <View style={styles.resultList}>
            {recentPlaces.slice(0, 3).map((place) => (
              <ListItemCard
                key={place.id}
                title={place.name}
                subtitle={place.address}
                dense
                onPress={() => onSelectPlace(place)}
              />
            ))}
          </View>
        </View>

        <View style={styles.conditionPanel}>
          <Text style={styles.sectionTitle}>저장된 장소</Text>
          <View style={styles.resultList}>
            {savedPlaces.map((place) => (
              <ListItemCard
                key={place.id}
                title={place.name}
                subtitle={place.address}
                dense
                onPress={() => onSelectPlace(place)}
              />
            ))}
          </View>
        </View>

        <View style={styles.optionSection}>
          <Text style={styles.sectionTitle}>이동 옵션</Text>
          <View style={styles.optionRow}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => onSelectOption(option.key)}
                style={({ pressed }) => [
                  styles.optionButton,
                  selectedOption === option.key ? styles.optionSelected : null,
                  { opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Text style={[styles.optionText, selectedOption === option.key ? styles.optionTextSelected : null]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomFixed}>
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>결과 미리보기</Text>
          <Text style={styles.previewItem}>추천 출발 시간: {preview.recommendedDeparture}</Text>
          <Text style={styles.previewItem}>예상 소요 시간: {preview.estimatedTravel}</Text>
          <Text style={styles.previewItem}>여유 시간: {preview.buffer}</Text>
        </View>
        <BottomCTA label="추천 결과 보기" status="warning" onPress={onPressRecommendation} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    gap: uiTheme.spacing.s12,
    paddingBottom: uiTheme.spacing.s24,
  },
  contentArea: {
    flex: 1,
  },
  contentScroll: {
    gap: uiTheme.spacing.s16,
    paddingBottom: uiTheme.spacing.s12,
  },
  conditionPanel: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    paddingHorizontal: uiTheme.spacing.s16,
    paddingVertical: uiTheme.spacing.s16,
    gap: uiTheme.spacing.s12,
  },
  sectionTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: uiTheme.spacing.s8,
  },
  fieldButton: {
    flex: 1,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s4,
  },
  fieldButtonActive: {
    borderColor: uiTheme.colors.primaryBlue,
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
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.s8,
  },
  arrivalControl: {
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    justifyContent: 'center',
  },
  arrivalControlText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
  },
  arrivalBadge: {
    flex: 1,
    minHeight: 44,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.card,
  },
  arrivalText: {
    ...uiTheme.typography.time,
    color: uiTheme.colors.textPrimary,
  },
  searchInput: {
    minHeight: 52,
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.background,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    paddingHorizontal: uiTheme.spacing.s16,
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
  },
  resultList: {
    gap: uiTheme.spacing.s8,
  },
  mapSelectCard: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    backgroundColor: uiTheme.colors.background,
    gap: uiTheme.spacing.s4,
  },
  mapSelectTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '500',
  },
  mapSelectSubtitle: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  saveArea: {
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.background,
    paddingHorizontal: uiTheme.spacing.s12,
    paddingVertical: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s8,
  },
  saveHint: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  saveButton: {
    minHeight: 42,
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
    minHeight: 48,
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
  saveActionGhost: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveActionGhostText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textSecondary,
  },
  saveActionPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: uiTheme.radius.medium,
    backgroundColor: uiTheme.colors.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveActionPrimaryText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  optionSection: {
    gap: uiTheme.spacing.s8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.s8,
  },
  optionButton: {
    minHeight: 40,
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.s12,
  },
  optionSelected: {
    borderColor: uiTheme.status.warning,
    backgroundColor: uiTheme.colors.background,
  },
  optionText: {
    ...uiTheme.typography.caption,
    color: uiTheme.colors.textPrimary,
  },
  optionTextSelected: {
    color: uiTheme.status.warning,
  },
  previewSection: {
    borderRadius: uiTheme.radius.large,
    backgroundColor: uiTheme.colors.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.divider,
    padding: uiTheme.spacing.s16,
    gap: uiTheme.spacing.s4,
  },
  bottomFixed: {
    marginTop: uiTheme.spacing.s12,
    gap: uiTheme.spacing.s12,
    paddingTop: uiTheme.spacing.s12,
  },
  previewTitle: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textPrimary,
    fontWeight: '600',
  },
  previewItem: {
    ...uiTheme.typography.body,
    color: uiTheme.colors.textSecondary,
  },
});
