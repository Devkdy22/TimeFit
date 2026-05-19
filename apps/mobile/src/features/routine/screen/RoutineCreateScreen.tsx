import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppScreen, Header, InfoCard, PrimaryButton } from '../../../components/app';
import { useAuth } from '../../auth/context';
import { appColors, appTypography } from '../../../theme/app-tokens';
import { useNavigationHelper } from '../../../utils/navigation';
import { useRoutines } from '../context';
import type { RoutineDay } from '../model/types';

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
  const { addRoutine } = useRoutines();
  const { isLoggedIn, pendingRoutineSeed, setPendingRoutineSeed } = useAuth();

  const [name, setName] = useState('');
  const [originName, setOriginName] = useState(pendingRoutineSeed?.originName ?? '');
  const [destinationName, setDestinationName] = useState(pendingRoutineSeed?.destinationName ?? '');
  const [timeMode, setTimeMode] = useState<'arrival' | 'departure'>('arrival');
  const [targetTime, setTargetTime] = useState(pendingRoutineSeed?.targetTime ?? '08:50');
  const [repeatDays, setRepeatDays] = useState<RoutineDay[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationMinutesBefore] = useState(10);
  const [favorite, setFavorite] = useState(false);
  const [memo, setMemo] = useState('');

  const valid = useMemo(
    () => name.trim().length > 0 && originName.trim().length > 0 && destinationName.trim().length > 0 && targetTime.trim().length > 0 && repeatDays.length > 0,
    [name, originName, destinationName, targetTime, repeatDays.length],
  );

  const onPressSave = () => {
    if (!isLoggedIn) {
      setPendingRoutineSeed({ originName, destinationName, targetTime });
      nav.goToLogin();
      return;
    }

    addRoutine({
      id: `routine-${Date.now()}`,
      name,
      originName,
      destinationName,
      targetTime,
      timeMode,
      repeatDays,
      notificationEnabled,
      notificationMinutesBefore,
      favorite,
      lastUsedAt: new Date().toISOString(),
    });

    setPendingRoutineSeed(null);
    Alert.alert('저장 완료', '루틴이 저장되었습니다.');
    nav.goToRoutines();
  };

  return (
    <AppScreen scrollable withKeyboardAvoiding contentContainerStyle={styles.container}>
      <Header
        title="새 루틴 만들기"
        onPressBack={nav.goBack}
        rightAction={
          <Pressable onPress={onPressSave} disabled={!valid}>
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
        <Pressable style={styles.swapRow} onPress={() => {
          setOriginName(destinationName);
          setDestinationName(originName);
        }}>
          <Ionicons name="swap-vertical" size={16} color={appColors.textSecondary} />
        </Pressable>
        <TextInput value={destinationName} onChangeText={setDestinationName} placeholder="도착지" placeholderTextColor={appColors.textMuted} style={styles.input} />
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
        <TextInput value={targetTime} onChangeText={setTargetTime} placeholder="08:50" placeholderTextColor={appColors.textMuted} style={styles.input} />
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

      <PrimaryButton label="저장하기" onPress={onPressSave} disabled={!valid} />
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
});
