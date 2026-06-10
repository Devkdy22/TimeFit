import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { AppScreen, Header, InfoCard, PrimaryButton } from '../../../components/app';
import { TimeWheelPicker } from '../../../components/home/TimeWheelPicker';
import { useAuth } from '../../auth/context';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useNavigationHelper } from '../../../utils/navigation';
import { useRoutines } from '../context';
import type { RoutineDay } from '../model/types';
import { ApiRequestError } from '../../../services/api/client';

const days: Array<{ key: RoutineDay; label: string }> = [
  { key: 'sun', label: '일' },
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
];

export function RoutineCreateScreen() {
  const nav = useNavigationHelper();
  const { createRoutineOnServer, savedPlaces, addSavedPlace } = useRoutines();
  const { isLoggedIn, pendingRoutineSeed, setPendingRoutineSeed } = useAuth();

  const [name, setName] = useState('');
  const [originName, setOriginName] = useState(pendingRoutineSeed?.originName ?? '');
  const [destinationName, setDestinationName] = useState(pendingRoutineSeed?.destinationName ?? '');
  const [timeMode, setTimeMode] = useState<'arrival' | 'departure'>('arrival');
  const [targetTime, setTargetTime] = useState(pendingRoutineSeed?.targetTime ?? '08:50');
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [repeatDays, setRepeatDays] = useState<RoutineDay[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationMinutesBefore] = useState(10);
  const [favorite, setFavorite] = useState(false);
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const valid = useMemo(
    () => name.trim().length > 0 && originName.trim().length > 0 && destinationName.trim().length > 0 && targetTime.trim().length > 0 && repeatDays.length > 0,
    [name, originName, destinationName, targetTime, repeatDays.length],
  );

  const onPressSave = () => {
    if (isSaving) {
      return;
    }
    if (!isLoggedIn) {
      setPendingRoutineSeed({ originName, destinationName, targetTime });
      nav.goToLogin();
      return;
    }

    void (async () => {
      setIsSaving(true);
      const originCoords = await resolveCoordinatesByName(originName);
      const destinationCoords = await resolveCoordinatesByName(destinationName);
      if (!originCoords || !destinationCoords) {
        Alert.alert('위치 확인', '출발지/도착지 위치를 찾지 못했습니다. 장소명을 더 정확히 입력해 주세요.');
        setIsSaving(false);
        return;
      }

      try {
        const controller = new AbortController();
        await createRoutineOnServer({
          name,
          originName,
          destinationName,
          originLat: originCoords.latitude,
          originLng: originCoords.longitude,
          destinationLat: destinationCoords.latitude,
          destinationLng: destinationCoords.longitude,
          targetTime,
          repeatDays,
          notificationEnabled,
          notificationMinutesBefore,
          favorite,
          signal: controller.signal,
        });
        setPendingRoutineSeed(null);
        Alert.alert('저장 완료', '루틴이 저장되었습니다.');
        nav.goToRoutines();
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === 'IDEMPOTENCY_PENDING') {
          Alert.alert('저장 처리 중', '동일한 루틴 저장 요청이 처리 중입니다. 잠시 후 다시 확인해 주세요.');
          return;
        }
        if (error instanceof ApiRequestError && error.code === 'IDEMPOTENCY_CONFLICT') {
          Alert.alert('중복 요청 충돌', '같은 요청 키로 다른 루틴 데이터가 감지되었습니다. 다시 시도해 주세요.');
          return;
        }
        if (error instanceof Error && error.message === 'stale_auth_session_response_discarded') {
          return;
        }
        Alert.alert('저장 실패', '루틴 저장 중 문제가 발생했습니다. 다시 시도해 주세요.');
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const applyCurrentLocationToOrigin = async () => {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '현재 위치를 출발지로 사용하려면 위치 권한을 허용해 주세요.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    const reversed = await Location.reverseGeocodeAsync({
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    });
    const first = reversed[0];
    const addressText = first
      ? [first.region, first.city, first.district, first.street, first.streetNumber].filter(Boolean).join(' ')
      : '현재 위치';
    setOriginName(addressText);
  };

  async function resolveCoordinatesByName(nameText: string) {
    const query = nameText.trim();
    if (!query) {
      return null;
    }
    const matchedSavedPlace = savedPlaces.find((place) => place.label === query || place.address === query);
    if (matchedSavedPlace) {
      return { latitude: matchedSavedPlace.latitude, longitude: matchedSavedPlace.longitude };
    }
    const geocoded = await Location.geocodeAsync(query);
    if (!geocoded.length) {
      return null;
    }
    return geocoded[0];
  }

  const saveCurrentOriginAsFavorite = async () => {
    const text = originName.trim();
    if (!text) {
      Alert.alert('장소 저장', '먼저 출발지 주소/장소를 입력해 주세요.');
      return;
    }
    const coords = await resolveCoordinatesByName(text);
    if (!coords) {
      Alert.alert('장소 저장', '해당 위치를 찾지 못해 저장할 수 없습니다.');
      return;
    }
    try {
      await addSavedPlace({
        label: text.length > 16 ? `${text.slice(0, 16)}...` : text,
        address: text,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      Alert.alert('저장 완료', '자주 가는 장소 목록에 저장했습니다.');
    } catch {
      Alert.alert('저장 실패', '장소 저장 중 문제가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <AppScreen scrollable withKeyboardAvoiding contentContainerStyle={styles.container}>
      <Header
        title="새 루틴 만들기"
        onPressBack={nav.goBack}
        rightAction={
          <Pressable onPress={onPressSave} disabled={!valid || isSaving}>
            <Text style={[styles.saveText, !valid ? styles.saveDisabled : null]}>저장</Text>
          </Pressable>
        }
      />

      <InfoCard>
        <Text style={styles.label}>루틴 이름</Text>
        <TextInput value={name} onChangeText={setName} placeholder="예) 출근, 퇴근, 등교" placeholderTextColor={appColors.textMuted} style={styles.input} />
      </InfoCard>

      <InfoCard>
        <Text style={styles.label}>이동 경로</Text>
        <TextInput value={originName} onChangeText={setOriginName} placeholder="출발지" placeholderTextColor={appColors.textMuted} style={styles.input} />
        <Pressable style={styles.locationAction} onPress={() => { void applyCurrentLocationToOrigin(); }}>
          <Text style={styles.locationActionText}>현재 위치를 출발지로 사용</Text>
        </Pressable>
        <Pressable style={styles.savePlaceAction} onPress={() => { void saveCurrentOriginAsFavorite(); }}>
          <Text style={styles.savePlaceActionText}>현재 출발지를 자주 가는 장소로 저장</Text>
        </Pressable>
        <View style={styles.savedPlaceList}>
          {savedPlaces.slice(0, 6).map((place) => (
            <Pressable key={place.id} onPress={() => setOriginName(place.address)} style={styles.savedPlaceChip}>
              <Text style={styles.savedPlaceChipLabel}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.swapRow} onPress={() => {
          setOriginName(destinationName);
          setDestinationName(originName);
        }}>
          <Ionicons name="swap-vertical" size={16} color={appColors.textSecondary} />
        </Pressable>
        <TextInput value={destinationName} onChangeText={setDestinationName} placeholder="도착지" placeholderTextColor={appColors.textMuted} style={styles.input} />
        <View style={styles.savedPlaceList}>
          {savedPlaces.slice(0, 6).map((place) => (
            <Pressable key={`dest-${place.id}`} onPress={() => setDestinationName(place.address)} style={styles.savedPlaceChip}>
              <Text style={styles.savedPlaceChipLabel}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
      </InfoCard>

      <InfoCard>
        <Text style={styles.label}>시간 설정</Text>
        <View style={styles.segmentWrap}>
          <Pressable style={[styles.segment, timeMode === 'arrival' ? styles.segmentOn : null]} onPress={() => setTimeMode('arrival')}>
            <Text style={[styles.segmentText, timeMode === 'arrival' ? styles.segmentTextOn : null]}>도착 시간 기준</Text>
          </Pressable>
          <Pressable style={[styles.segment, timeMode === 'departure' ? styles.segmentOn : null]} onPress={() => setTimeMode('departure')}>
            <Text style={[styles.segmentText, timeMode === 'departure' ? styles.segmentTextOn : null]}>출발 시간 기준</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setTimePickerVisible(true)} style={styles.timeSelectButton}>
          <Text style={styles.timeSelectLabel}>시간 선택</Text>
          <Text style={styles.timeSelectValue}>{targetTime}</Text>
        </Pressable>
      </InfoCard>

      <InfoCard>
        <Text style={styles.label}>반복 요일</Text>
        <View style={styles.dayWrap}>
          {days.map((day) => {
            const selected = repeatDays.includes(day.key);
            return (
              <Pressable
                key={day.key}
                style={[styles.dayChip, selected ? styles.dayChipOn : null]}
                onPress={() => setRepeatDays((prev) => (selected ? prev.filter((item) => item !== day.key) : [...prev, day.key]))}
              >
                <Text style={[styles.dayText, selected ? styles.dayTextOn : null]}>{day.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </InfoCard>

      <InfoCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>알림 설정</Text>
            <Text style={styles.helper}>출발 {notificationMinutesBefore}분 전 알림</Text>
          </View>
          <Switch value={notificationEnabled} onValueChange={setNotificationEnabled} />
        </View>
      </InfoCard>

      <InfoCard>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>즐겨찾기에 추가</Text>
          <Switch value={favorite} onValueChange={setFavorite} />
        </View>
      </InfoCard>

      <InfoCard>
        <Text style={styles.label}>메모 (선택)</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="메모를 입력하세요"
          placeholderTextColor={appColors.textMuted}
          style={[styles.input, styles.memo]}
          multiline
        />
      </InfoCard>

      <PrimaryButton label={isSaving ? '저장 중...' : '저장하기'} onPress={onPressSave} disabled={!valid || isSaving} />

      <TimeWheelPicker
        visible={timePickerVisible}
        initialTime={targetTime}
        accentColor={appColors.primary}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(time) => {
          setTargetTime(time);
          setTimePickerVisible(false);
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120 },
  label: { color: appColors.textPrimary, marginBottom: 8, ...appTypography.caption },
  input: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingHorizontal: 14,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  memo: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  saveText: { color: appColors.primaryDark, ...appTypography.body },
  saveDisabled: { color: appColors.textMuted },
  swapRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  locationAction: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#F1FAF9',
    borderWidth: 1,
    borderColor: '#DDEDEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  locationActionText: { color: appColors.primaryDark, fontSize: 13, fontWeight: '600' },
  savePlaceAction: {
    minHeight: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  savePlaceActionText: {
    color: '#2E8B87',
    fontSize: 12,
    fontWeight: '600',
  },
  savedPlaceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  savedPlaceChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCECEB',
    backgroundColor: '#F4FAF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPlaceChipLabel: {
    color: '#3D6D6A',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentWrap: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: appColors.primaryLight,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 10,
  },
  segment: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: '#FFFFFF' },
  segmentText: { color: appColors.textSecondary, ...appTypography.caption },
  segmentTextOn: { color: appColors.primaryDark, fontWeight: '600' },
  dayWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    minWidth: 42,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  dayText: { color: appColors.textSecondary, ...appTypography.caption },
  dayTextOn: { color: '#FFFFFF', fontWeight: '600' },
  rowBetween: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  helper: { color: appColors.textSecondary, ...appTypography.small },
  timeSelectButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSelectLabel: { color: appColors.textSecondary, ...appTypography.caption },
  timeSelectValue: { color: appColors.textPrimary, fontSize: 18, fontWeight: '700' },
});
