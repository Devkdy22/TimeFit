import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AppScreen, PrimaryButton, RoutineCard, TimeyMascot } from '../../../components/app';
import { TimeWheelPicker } from '../../../components/home/TimeWheelPicker';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useRoutines } from '../context';
import type { Routine, RoutineDay } from '../model/types';
import { useNavigationHelper } from '../../../utils/navigation';
import { useAuth } from '../../auth/context';
import { useCommutePlan } from '../../commute-state/context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ApiRequestError } from '../../../services/api/client';

type RoutineTab = 'all' | 'favorite' | 'recent';
const days: Array<{ key: RoutineDay; label: string }> = [
  { key: 'sun', label: '일' },
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
];

export function RoutineScreen() {
  const nav = useNavigationHelper();
  const { applyPlaceToField, setArrivalAt, setSelectedRoute } = useCommutePlan();
  const { routines, savedPlaces, toggleFavorite, createRoutineOnServer, updateRoutine, removeRoutine, addSavedPlace } = useRoutines();
  const { isLoggedIn, setPendingRoutineSeed } = useAuth();
  const [activeTab, setActiveTab] = useState<RoutineTab>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [originName, setOriginName] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [targetTime, setTargetTime] = useState('08:50');
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [repeatDays, setRepeatDays] = useState<RoutineDay[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [favorite, setFavorite] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editTargetTime, setEditTargetTime] = useState('');
  const [editTimePickerVisible, setEditTimePickerVisible] = useState(false);
  const [editRepeatDays, setEditRepeatDays] = useState<RoutineDay[]>([]);
  const [editNotificationEnabled, setEditNotificationEnabled] = useState(true);
  const [editFavorite, setEditFavorite] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const heartPop = useRef(new Animated.Value(0)).current;
  const valid = useMemo(
    () =>
      name.trim().length > 0 &&
      originName.trim().length > 0 &&
      destinationName.trim().length > 0 &&
      targetTime.trim().length > 0 &&
      repeatDays.length > 0,
    [name, originName, destinationName, targetTime, repeatDays.length],
  );

  const filteredRoutines = useMemo(() => {
    if (activeTab === 'favorite') {
      return routines.filter((item) => item.favorite);
    }
    if (activeTab === 'recent') {
      return routines
        .filter((item) => Boolean(item.lastUsedAt))
        .sort(
          (a, b) => new Date(b.lastUsedAt ?? '').getTime() - new Date(a.lastUsedAt ?? '').getTime(),
        );
    }
    return routines;
  }, [activeTab, routines]);

  useEffect(() => {
    const heartLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartPop, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(heartPop, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    heartLoop.start();
    return () => {
      heartLoop.stop();
    };
  }, [heartPop]);

  const renderItem = ({ item }: { item: Routine }) => (
    <RoutineCard
      routine={item}
      onPress={() => {
        if (!item.active) {
          Alert.alert('비활성 루틴', '요일을 선택하고 활성화한 뒤 사용할 수 있습니다.');
          return;
        }
        applyPlaceToField('origin', {
          id: `routine-origin-${item.id}`,
          name: item.originName,
          address: item.originName,
          latitude: item.originLat,
          longitude: item.originLng,
          iconType: 'location',
        });
        applyPlaceToField('destination', {
          id: `routine-destination-${item.id}`,
          name: item.destinationName,
          address: item.destinationName,
          latitude: item.destinationLat,
          longitude: item.destinationLng,
          iconType: 'location',
        });
        setArrivalAt(item.targetTime);
        setSelectedRoute(null);
        nav.goToRecommendation();
      }}
      onPressFavorite={() => toggleFavorite(item.id)}
      onPressMore={() => {
        setSelectedRoutine(item);
        setEditName(item.name);
        setEditOrigin(item.originName);
        setEditDestination(item.destinationName);
        setEditTargetTime(item.targetTime);
        setEditRepeatDays(item.repeatDays);
        setEditNotificationEnabled(item.notificationEnabled);
        setEditFavorite(item.favorite);
        setEditActive(item.active);
        setEditVisible(true);
      }}
    />
  );

  const resetCreateForm = () => {
    setName('');
    setOriginName('');
    setDestinationName('');
    setTargetTime('08:50');
    setRepeatDays(['mon', 'tue', 'wed', 'thu', 'fri']);
    setFavorite(false);
    setNotificationEnabled(true);
  };

  const openCreatePopup = () => setCreateVisible(true);

  const closeCreatePopup = () => {
    setCreateVisible(false);
    resetCreateForm();
  };

  const saveRoutine = () => {
    if (isCreating) {
      return;
    }
    if (!valid) {
      return;
    }
    void (async () => {
      setIsCreating(true);
      const originCoords = await resolveCoordinatesByName(originName);
      const destinationCoords = await resolveCoordinatesByName(destinationName);
      if (!originCoords || !destinationCoords) {
        Alert.alert('위치 확인', '출발지/도착지 위치를 찾지 못했습니다. 장소명을 더 정확히 입력해 주세요.');
        setIsCreating(false);
        return;
      }
      if (!isLoggedIn) {
        setPendingRoutineSeed({ originName, destinationName, targetTime });
        setCreateVisible(false);
        nav.goToLogin();
        setIsCreating(false);
        return;
      }
      try {
        const controller = new AbortController();
        await createRoutineOnServer({
          name,
          originName: normalizeDisplayName(originName),
          destinationName: normalizeDisplayName(destinationName),
          originLat: originCoords.latitude,
          originLng: originCoords.longitude,
          destinationLat: destinationCoords.latitude,
          destinationLng: destinationCoords.longitude,
          targetTime,
          repeatDays,
          notificationEnabled,
          notificationMinutesBefore: 10,
          favorite,
          signal: controller.signal,
        });
        Alert.alert('저장 완료', '루틴이 저장되었습니다.');
        closeCreatePopup();
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
        setIsCreating(false);
      }
    })();
  };

  const saveEditRoutine = () => {
    if (!selectedRoutine) {
      return;
    }
    if (!editName.trim() || !editOrigin.trim() || !editDestination.trim() || !editTargetTime.trim()) {
      return;
    }
    void (async () => {
      const nextRepeatDays = editRepeatDays.length ? editRepeatDays : selectedRoutine.repeatDays;
      if (editActive && nextRepeatDays.length === 0) {
        Alert.alert('요일 선택 필요', '활성화하려면 반복 요일을 하나 이상 선택해 주세요.');
        return;
      }
      const originCoords = await resolveCoordinatesByName(editOrigin);
      const destinationCoords = await resolveCoordinatesByName(editDestination);
      if (!originCoords || !destinationCoords) {
        Alert.alert('위치 확인', '출발지/도착지 위치를 찾지 못했습니다. 장소명을 더 정확히 입력해 주세요.');
        return;
      }
      try {
        await updateRoutine(selectedRoutine.id, {
          name: editName.trim(),
          originName: normalizeDisplayName(editOrigin),
          destinationName: normalizeDisplayName(editDestination),
          originLat: originCoords.latitude,
          originLng: originCoords.longitude,
          destinationLat: destinationCoords.latitude,
          destinationLng: destinationCoords.longitude,
          targetTime: editTargetTime.trim(),
          repeatDays: nextRepeatDays,
          notificationEnabled: editNotificationEnabled,
          favorite: editFavorite,
          active: editActive,
        });
        setEditVisible(false);
        setSelectedRoutine(null);
        Alert.alert('수정 완료', '루틴 정보가 업데이트되었습니다.');
      } catch {
        Alert.alert('수정 실패', '루틴 수정 중 문제가 발생했습니다. 다시 시도해 주세요.');
      }
    })();
  };

  const applyCurrentLocationToOrigin = async (isEdit: boolean) => {
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
    if (isEdit) {
      setEditOrigin(addressText);
    } else {
      setOriginName(addressText);
    }
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

  function normalizeDisplayName(input: string) {
    const trimmed = input.trim();
    const matchedSavedPlace = savedPlaces.find((place) => place.label === trimmed || place.address === trimmed);
    return matchedSavedPlace?.address ?? trimmed;
  }

  const saveCurrentOriginAsFavorite = async (isEdit: boolean) => {
    const text = (isEdit ? editOrigin : originName).trim();
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

  const deleteRoutine = () => {
    if (!selectedRoutine) {
      return;
    }
    const target = selectedRoutine;
    Alert.alert('루틴 삭제', `'${target.name}' 루틴을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeRoutine(target.id);
              setEditVisible(false);
              setSelectedRoutine(null);
            } catch {
              Alert.alert('삭제 실패', '루틴 삭제 중 문제가 발생했습니다. 다시 시도해 주세요.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <AppScreen style={styles.screen} contentContainerStyle={styles.screenContent}>
      <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="routineBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#ECF9F8" />
            <Stop offset="55%" stopColor="#E6F4F3" />
            <Stop offset="100%" stopColor="#F2FAFA" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#routineBg)" />
      </Svg>

      <View style={styles.topButtonsRow}>
        <Pressable
          onPress={nav.goBack}
          style={({ pressed }) => [
            styles.roundButton,
            styles.backButton,
            { opacity: pressed ? 0.84 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.roundButton,
            styles.alertButton,
            { opacity: pressed ? 0.84 : 1 },
          ]}
        >
          <Ionicons name="notifications-outline" size={18} color={appColors.primaryDark} />
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleTextWrap}>
          <Text style={styles.title}>내 루틴</Text>
          <Text style={styles.subtitle}>내 이동 루틴을 한눈에 확인하세요.</Text>
        </View>
        <View style={styles.mascotWrap}>
          <Animated.View
            style={[
              styles.heartBubble,
              {
                transform: [
                  {
                    scale: heartPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }),
                  },
                  {
                    translateY: heartPop.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="heart" size={13} color="#F09AA0" />
          </Animated.View>
          <View>
            <TimeyMascot size={94} expression="neutral" />
          </View>
        </View>
      </View>

      <View style={styles.combinedBox}>
        <View style={styles.tabRow}>
          {[
            { key: 'all', label: '전체' },
            { key: 'favorite', label: '즐겨찾기' },
            { key: 'recent', label: '최근 사용' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key as RoutineTab)}
                style={styles.tab}
              >
                <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                  {tab.label}
                </Text>
                {active ? (
                  <View style={styles.tabUnderline} />
                ) : (
                  <View style={styles.tabUnderlineSpacer} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.listBox}>
          {filteredRoutines.length === 0 ? (
            <View style={styles.emptyWrap}>
              <TimeyMascot size={80} expression="neutral" />
              <Text style={styles.emptyTitle}>아직 저장된 루틴이 없어요</Text>
              <Text style={styles.emptyBody}>
                자주 가는 경로를 저장하면 더 빠르게 이동할 수 있어요.
              </Text>
              <PrimaryButton label="루틴 만들기" onPress={openCreatePopup} />
            </View>
          ) : (
            <FlatList
              data={filteredRoutines}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
      <View style={styles.footerHintRow}>
        <Ionicons name="bookmark-outline" size={14} color="#6C8C8A" />
        <Text style={styles.footerHintText}>중요한 루틴은 즐겨찾기를 해보세요</Text>
      </View>

      <Pressable
        onPress={openCreatePopup}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.9 : 1 }]}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      <Modal transparent visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>루틴 수정</Text>
              <Pressable onPress={() => setEditVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={appColors.textSecondary} />
              </Pressable>
            </View>

            <TextInput value={editName} onChangeText={setEditName} placeholder="루틴 이름" placeholderTextColor={appColors.textMuted} style={styles.input} />
            <TextInput value={editOrigin} onChangeText={setEditOrigin} placeholder="출발지" placeholderTextColor={appColors.textMuted} style={styles.input} />
            <Pressable onPress={() => { void applyCurrentLocationToOrigin(true); }} style={styles.locationAction}>
              <Text style={styles.locationActionText}>현재 위치를 출발지로 사용</Text>
            </Pressable>
            <Pressable onPress={() => { void saveCurrentOriginAsFavorite(true); }} style={styles.savePlaceAction}>
              <Text style={styles.savePlaceActionText}>현재 출발지를 자주 가는 장소로 저장</Text>
            </Pressable>
            <View style={styles.savedPlaceList}>
              {savedPlaces.slice(0, 6).map((place) => (
                <Pressable key={place.id} onPress={() => setEditOrigin(place.address)} style={styles.savedPlaceChip}>
                  <Text style={styles.savedPlaceChipLabel}>{place.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={editDestination} onChangeText={setEditDestination} placeholder="도착지" placeholderTextColor={appColors.textMuted} style={styles.input} />
            <Pressable onPress={() => setEditTimePickerVisible(true)} style={styles.timeSelectButton}>
              <Text style={styles.timeSelectLabel}>시간 선택</Text>
              <Text style={styles.timeSelectValue}>{editTargetTime}</Text>
            </Pressable>

            <View style={styles.dayWrap}>
              {days.map((day) => {
                const selected = editRepeatDays.includes(day.key);
                return (
                  <Pressable
                    key={day.key}
                    style={[styles.dayChip, selected ? styles.dayChipOn : null]}
                    onPress={() =>
                      setEditRepeatDays((prev) =>
                        selected ? prev.filter((item) => item !== day.key) : [...prev, day.key],
                      )
                    }
                  >
                    <Text style={[styles.dayText, selected ? styles.dayTextOn : null]}>{day.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>즐겨찾기</Text>
              <Switch value={editFavorite} onValueChange={setEditFavorite} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>알림 사용</Text>
              <Switch value={editNotificationEnabled} onValueChange={setEditNotificationEnabled} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>활성화</Text>
              <Switch value={editActive} onValueChange={setEditActive} />
            </View>

            <View style={styles.editActionRow}>
              <Pressable onPress={deleteRoutine} style={styles.deleteTextButton}>
                <Text style={styles.deleteTextLink}>삭제</Text>
              </Pressable>
              <View style={styles.editSaveWrap}>
                <PrimaryButton label="수정 저장" onPress={saveEditRoutine} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={createVisible}
        animationType="slide"
        onRequestClose={closeCreatePopup}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCreatePopup} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>새 루틴 만들기</Text>
              <Pressable onPress={closeCreatePopup} hitSlop={8}>
                <Ionicons name="close" size={22} color={appColors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="루틴 이름"
              placeholderTextColor={appColors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={originName}
              onChangeText={setOriginName}
              placeholder="출발지"
              placeholderTextColor={appColors.textMuted}
              style={styles.input}
            />
            <Pressable onPress={() => { void applyCurrentLocationToOrigin(false); }} style={styles.locationAction}>
              <Text style={styles.locationActionText}>현재 위치를 출발지로 사용</Text>
            </Pressable>
            <Pressable onPress={() => { void saveCurrentOriginAsFavorite(false); }} style={styles.savePlaceAction}>
              <Text style={styles.savePlaceActionText}>현재 출발지를 자주 가는 장소로 저장</Text>
            </Pressable>
            <View style={styles.savedPlaceList}>
              {savedPlaces.slice(0, 6).map((place) => (
                <Pressable key={place.id} onPress={() => setOriginName(place.address)} style={styles.savedPlaceChip}>
                  <Text style={styles.savedPlaceChipLabel}>{place.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={destinationName}
              onChangeText={setDestinationName}
              placeholder="도착지"
              placeholderTextColor={appColors.textMuted}
              style={styles.input}
            />
            <View style={styles.savedPlaceList}>
              {savedPlaces.slice(0, 6).map((place) => (
                <Pressable key={`dest-${place.id}`} onPress={() => setDestinationName(place.address)} style={styles.savedPlaceChip}>
                  <Text style={styles.savedPlaceChipLabel}>{place.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setTimePickerVisible(true)} style={styles.timeSelectButton}>
              <Text style={styles.timeSelectLabel}>시간 선택</Text>
              <Text style={styles.timeSelectValue}>{targetTime}</Text>
            </Pressable>

            <View style={styles.dayWrap}>
              {days.map((day) => {
                const selected = repeatDays.includes(day.key);
                return (
                  <Pressable
                    key={day.key}
                    style={[styles.dayChip, selected ? styles.dayChipOn : null]}
                    onPress={() =>
                      setRepeatDays((prev) =>
                        selected ? prev.filter((item) => item !== day.key) : [...prev, day.key],
                      )
                    }
                  >
                    <Text style={[styles.dayText, selected ? styles.dayTextOn : null]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>즐겨찾기</Text>
              <Switch value={favorite} onValueChange={setFavorite} />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>알림 사용</Text>
              <Switch value={notificationEnabled} onValueChange={setNotificationEnabled} />
            </View>

            <PrimaryButton label="저장하기" onPress={saveRoutine} disabled={!valid} />
          </View>
        </View>
      </Modal>

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
      <TimeWheelPicker
        visible={editTimePickerVisible}
        initialTime={editTargetTime}
        accentColor={appColors.primary}
        onClose={() => setEditTimePickerVisible(false)}
        onConfirm={(time) => {
          setEditTargetTime(time);
          setEditTimePickerVisible(false);
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0, backgroundColor: '#EAF6F5' },
  screenContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  topButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: appColors.primary,
    shadowColor: appColors.primaryDark,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  alertButton: {
    backgroundColor: '#F0F7F7',
    borderWidth: 1,
    borderColor: '#E2ECEB',
  },
  titleRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleTextWrap: { marginLeft: 10 },
  title: { color: appColors.textPrimary, fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 6, color: appColors.textSecondary, fontSize: 14, fontWeight: '500' },
  mascotWrap: {
    width: 110,
    height: 104,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heartBubble: {
    position: 'absolute',
    top: 2,
    left: 10,
    width: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F9F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3E1E0',
  },
  combinedBox: {
    marginTop: -25,
    flex: 0,
    height: '65%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EEEE',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabRow: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tabText: { color: appColors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: appColors.primaryDark, fontWeight: '700' },
  tabUnderline: {
    marginTop: 4,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: appColors.primary,
  },
  tabUnderlineSpacer: { marginTop: 4, width: 28, height: 2 },
  listBox: {
    marginTop: 8,
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 8,
    overflow: 'hidden',
  },
  listScroll: { flex: 1 },
  listContent: { paddingBottom: 20, paddingTop: 2 },
  separator: { height: 10 },
  fab: {
    position: 'absolute',
    right: 30,
    bottom: 52,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: appColors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 40,
  },
  emptyTitle: { color: appColors.textPrimary, ...appTypography.sectionTitle },
  emptyBody: { color: appColors.textSecondary, textAlign: 'center', ...appTypography.body },
  footerHintRow: {
    minHeight: 28,
    marginTop: -12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerHintText: {
    color: '#6C8C8A',
    fontSize: 13,
    fontWeight: '500',
  },
  deleteTextButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deleteTextLink: { color: '#C74141', fontSize: 14, fontWeight: '600' },
  editActionRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editSaveWrap: { flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 33, 33, 0.26)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 10,
  },
  sheetHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: { color: appColors.textPrimary, ...appTypography.sectionTitle },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    paddingHorizontal: 12,
    color: appColors.textPrimary,
    ...appTypography.body,
  },
  locationAction: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#F1FAF9',
    borderWidth: 1,
    borderColor: '#DDEDEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  locationActionText: {
    color: appColors.primaryDark,
    fontSize: 13,
    fontWeight: '600',
  },
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
    marginTop: -2,
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

  dayWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: 4 },
  dayChip: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: appColors.primary, borderColor: appColors.primary },
  dayText: { color: appColors.textSecondary, ...appTypography.caption },
  dayTextOn: { color: '#FFFFFF', fontWeight: '600' },
  toggleRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { color: appColors.textPrimary, ...appTypography.caption },
});
