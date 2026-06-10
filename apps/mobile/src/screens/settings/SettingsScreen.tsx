import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { useAuth } from '../../features/auth/context';
import { useRoutines } from '../../features/routine/context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

export function SettingsScreen() {
  const nav = useNavigationHelper();
  const { isLoggedIn, logout, profile } = useAuth();
  const { savedPlaces, removeSavedPlace, addSavedPlace } = useRoutines();
  const [isVibrationEnabled, setVibrationEnabled] = useState(true);
  const [placeLabel, setPlaceLabel] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [departureLeadTime] = useState('5분 전');
  const [routineAlertEnabled] = useState(true);
  const [emergencyAlertEnabled] = useState(true);
  const profileName = profile?.name ?? '사용자';
  const profileEmail = profile?.email ?? '이메일 정보 없음';
  const providerLabel = profile?.provider
    ? `${profile.provider.charAt(0).toUpperCase()}${profile.provider.slice(1)} 로그인`
    : '소셜 로그인';

  const handleSavePlace = async () => {
    const label = placeLabel.trim();
    const address = placeAddress.trim();
    if (!label || !address) {
      Alert.alert('장소 저장', '이름과 주소를 모두 입력해 주세요.');
      return;
    }
    const geocoded = await Location.geocodeAsync(address);
    if (!geocoded.length) {
      Alert.alert('장소 저장', '해당 주소를 찾지 못했습니다. 주소를 다시 확인해 주세요.');
      return;
    }
    try {
      await addSavedPlace({
        label,
        address,
        latitude: geocoded[0].latitude,
        longitude: geocoded[0].longitude,
      });
      setPlaceLabel('');
      setPlaceAddress('');
      Alert.alert('저장 완료', '저장 장소 목록에 추가되었습니다.');
    } catch {
      Alert.alert('저장 실패', '장소 저장 중 문제가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProfileCard
          name={isLoggedIn ? profileName : '게스트'}
          email={isLoggedIn ? profileEmail : '로그인 후 계정 동기화'}
          providerLabel={isLoggedIn ? providerLabel : '로그인 필요'}
          isLoginRequired={!isLoggedIn}
          onPress={isLoggedIn ? nav.goToSettingsAccount : nav.goToLogin}
          onPressLoginRequired={nav.goToLogin}
        />

        <SettingsSection title="알림" subtitle="이동과 루틴 관련 알림을 관리하세요">
          <SettingsRow variant="navigation" icon="notifications-outline" title="출발 알림" subtitle="이동 시작 전에 미리 알려드려요" summary={departureLeadTime} onPress={nav.goToDepartureNotificationSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="time-outline" title="루틴 알림" subtitle="저장한 루틴 일정에 맞춰 알려드려요" summary={routineAlertEnabled ? '켜짐' : '꺼짐'} onPress={nav.goToRoutineNotificationSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="warning-outline" title="긴급 알림" subtitle="지연, 경로 변경 등 중요 알림" summary={emergencyAlertEnabled ? '켜짐' : '꺼짐'} onPress={nav.goToEmergencyNotificationSettings} />
        </SettingsSection>

        <SettingsSection title="앱 설정">
          <SettingsRow variant="navigation" icon="contrast-outline" title="다크 모드" summary="시스템 설정" onPress={nav.goToThemeSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="toggle" icon="phone-portrait-outline" title="진동" subtitle="알림 진동 사용" value={isVibrationEnabled} onToggle={setVibrationEnabled} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="language-outline" title="언어" summary="한국어" onPress={nav.goToLanguageSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="speedometer-outline" title="거리 단위" summary="km" onPress={nav.goToUnitSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="time-outline" title="시간 형식" summary="24시간" onPress={nav.goToTimeFormatSettings} />
        </SettingsSection>

        <SettingsSection title="저장 장소" subtitle="루틴에서 빠르게 선택할 장소 목록">
          <View style={styles.placeForm}>
            <TextInput
              value={placeLabel}
              onChangeText={setPlaceLabel}
              placeholder="장소 이름 (예: 집, 회사)"
              placeholderTextColor={settingsTokens.colors.textMuted}
              style={styles.placeInput}
            />
            <TextInput
              value={placeAddress}
              onChangeText={setPlaceAddress}
              placeholder="주소 또는 장소명"
              placeholderTextColor={settingsTokens.colors.textMuted}
              style={styles.placeInput}
            />
            <Pressable onPress={() => { void handleSavePlace(); }} style={({ pressed }) => [styles.savePlaceButton, { opacity: pressed ? 0.85 : 1 }]}>
              <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.savePlaceButtonText}>장소 저장</Text>
            </Pressable>
          </View>
          <View style={styles.formDivider} />

          {savedPlaces.length === 0 ? (
            <View style={styles.emptyPlaceRow}>
              <Text style={styles.emptyPlaceText}>저장된 장소가 없습니다.</Text>
            </View>
          ) : (
            savedPlaces.map((place, index) => (
              <View key={place.id}>
                <View style={styles.placeRow}>
                  <View style={styles.placeTextWrap}>
                    <Text style={styles.placeLabel}>{place.label}</Text>
                    <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Alert.alert('장소 삭제', `'${place.label}' 장소를 삭제할까요?`, [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '삭제',
                          style: 'destructive',
                          onPress: () => {
                            void (async () => {
                              try {
                                await removeSavedPlace(place.id);
                              } catch {
                                Alert.alert('삭제 실패', '장소 삭제 중 문제가 발생했습니다. 다시 시도해 주세요.');
                              }
                            })();
                          },
                        },
                      ]);
                    }}
                    style={({ pressed }) => [styles.deletePlaceButton, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="trash-outline" size={18} color={settingsTokens.colors.textMuted} />
                  </Pressable>
                </View>
                {index < savedPlaces.length - 1 ? <View style={styles.placeDivider} /> : null}
              </View>
            ))
          )}
        </SettingsSection>

        <SettingsSection title="정보">
          <SettingsRow variant="navigation" icon="person-circle-outline" title="계정 정보" onPress={nav.goToSettingsAccount} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="document-text-outline" title="이용 약관" onPress={nav.goToTermsSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="shield-checkmark-outline" title="개인정보 처리방침" onPress={nav.goToPrivacySettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="help-circle-outline" title="도움말 및 문의" onPress={nav.goToHelpSettings} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="information-circle-outline" title="버전 정보" summary="1.0.0" onPress={nav.goToAboutSettings} />
        </SettingsSection>

        {isLoggedIn ? (
          <SettingsSection title="계정 액션">
            <SettingsRow
              variant="danger"
              title="로그아웃"
              onPress={() => {
                Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '로그아웃',
                    style: 'destructive',
                    onPress: () => {
                      logout();
                      nav.goBack();
                    },
                  },
                ]);
              }}
            />
          </SettingsSection>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: settingsTokens.colors.background },
  header: {
    minHeight: 52,
    paddingHorizontal: settingsTokens.spacing.screenX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  content: {
    paddingHorizontal: settingsTokens.spacing.screenX,
    paddingBottom: 42,
    gap: settingsTokens.spacing.sectionGap,
  },
  divider: { height: 1, backgroundColor: settingsTokens.colors.border, marginLeft: 68 },
  placeDivider: { height: 1, backgroundColor: settingsTokens.colors.border, marginLeft: 16 },
  placeRow: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  placeTextWrap: { flex: 1, gap: 2 },
  placeLabel: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  placeAddress: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
  deletePlaceButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F8F8',
  },
  emptyPlaceRow: {
    minHeight: 64,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  emptyPlaceText: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
  placeForm: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  placeInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: settingsTokens.colors.border,
    paddingHorizontal: 12,
    color: settingsTokens.colors.textPrimary,
    ...settingsTokens.typography.body,
  },
  savePlaceButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#4CC7C1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  savePlaceButtonText: {
    color: '#FFFFFF',
    ...settingsTokens.typography.body,
  },
  formDivider: { height: 1, backgroundColor: settingsTokens.colors.border, marginLeft: 16 },
});
