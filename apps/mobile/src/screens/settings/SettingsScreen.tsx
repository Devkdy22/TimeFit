import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { useAuth } from '../../features/auth/context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '../../services/api/client';
import { getLocationPermissionLabel } from './locationPermission';
import { canPersistNotificationEnabled, resolveNotificationToggleValue, type NotificationPermissionStatus } from './notificationPermission';

const departureLeadOptions = [5, 10, 15, 20];

export function SettingsScreen() {
  const nav = useNavigationHelper();
  const { isLoggedIn, logout, deleteAccount, profile } = useAuth();
  const [isVibrationEnabled, setVibrationEnabled] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    notificationEnabled: true,
    departureLeadMinutes: 5,
    delayNotificationEnabled: true,
    rerouteNotificationEnabled: true,
    vibrationEnabled: true,
  });
  const [locationStatus, setLocationStatus] = useState('확인 중');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<Notifications.PermissionStatus>(Notifications.PermissionStatus.UNDETERMINED);
  const profileName = profile?.name ?? '사용자';
  const profileEmail = profile?.email ?? '이메일 정보 없음';
  const providerLabel = profile?.provider
    ? `${profile.provider.charAt(0).toUpperCase()}${profile.provider.slice(1)} 로그인`
    : '소셜 로그인';

  const refreshLocationStatus = useCallback(() => {
    void Location.getForegroundPermissionsAsync()
      .then((permission) => setLocationStatus(getLocationPermissionLabel(permission.status)))
      .catch(() => setLocationStatus('확인 불가'));
  }, []);

  const refreshNotificationPermissionStatus = useCallback(() => {
    void Notifications.getPermissionsAsync()
      .then((permission) => setNotificationPermissionStatus(permission.status))
      .catch(() => setNotificationPermissionStatus(Notifications.PermissionStatus.UNDETERMINED));
  }, []);

  useEffect(() => {
    refreshLocationStatus();
    refreshNotificationPermissionStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshLocationStatus();
        refreshNotificationPermissionStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshLocationStatus, refreshNotificationPermissionStatus]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void getNotificationPreferences().then((preferences) => {
      setNotificationPreferences(preferences);
      setVibrationEnabled(preferences.vibrationEnabled);
      void AsyncStorage.setItem('settings.vibrationEnabled', String(preferences.vibrationEnabled));
    }).catch(() => undefined);
  }, [isLoggedIn]);

  useEffect(() => {
    void AsyncStorage.getItem('settings.vibrationEnabled').then((value) => {
      if (value !== null) setVibrationEnabled(value !== 'false');
    });
  }, []);

  const handleVibrationChange = (enabled: boolean) => {
    setVibrationEnabled(enabled);
    setNotificationPreferences((current) => ({ ...current, vibrationEnabled: enabled }));
    void AsyncStorage.setItem('settings.vibrationEnabled', String(enabled));
    if (isLoggedIn) {
      void updateNotificationPreferences({ vibrationEnabled: enabled }).catch(() => {
        void getNotificationPreferences().then((preferences) => {
          setNotificationPreferences(preferences);
          setVibrationEnabled(preferences.vibrationEnabled);
          void AsyncStorage.setItem('settings.vibrationEnabled', String(preferences.vibrationEnabled));
        }).catch(() => undefined);
      });
    }
  };

  const openLocationSettings = () => {
    void Linking.openSettings().catch(() => {
      Alert.alert('위치 권한', '설정 화면을 열지 못했습니다. 기기 설정에서 위치 권한을 확인해 주세요.');
    });
  };

  const updatePreferences = (patch: Partial<NotificationPreferences>) => {
    setNotificationPreferences((current) => ({ ...current, ...patch }));
    if (!isLoggedIn) return;
    void updateNotificationPreferences(patch).catch(() => {
      void getNotificationPreferences().then(setNotificationPreferences).catch(() => undefined);
    });
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      updatePreferences({ notificationEnabled: false });
      return;
    }

    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Notifications.requestPermissionsAsync();
    }
    setNotificationPermissionStatus(permission.status);
    if (permission.status !== 'granted') {
      Alert.alert(
        '알림 권한 필요',
        'TimeFit 알림을 받으려면 기기 알림 권한을 허용해 주세요.',
        [{ text: '설정 열기', onPress: () => { void Linking.openSettings(); } }, { text: '취소', style: 'cancel' }],
      );
      return;
    }

    if (canPersistNotificationEnabled(true, permission.status as NotificationPermissionStatus)) {
      updatePreferences({ notificationEnabled: true });
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
          <SettingsRow
            variant="toggle"
            icon="notifications-outline"
            title="알림 전체"
            subtitle={notificationPermissionStatus === Notifications.PermissionStatus.DENIED ? '기기 알림 권한을 허용해야 받을 수 있어요' : '모든 Push 알림을 켜거나 끕니다'}
            value={resolveNotificationToggleValue(notificationPreferences.notificationEnabled, notificationPermissionStatus as NotificationPermissionStatus)}
            onToggle={(value) => { void handleNotificationToggle(value); }}
          />
          <View style={styles.divider} />
          <View style={styles.preferenceGroup}>
            <Text style={styles.preferenceLabel}>출발 알림 시점</Text>
            <View style={styles.leadWrap}>
              {departureLeadOptions.map((minutes) => (
                <Pressable key={minutes} onPress={() => updatePreferences({ departureLeadMinutes: minutes })} style={[styles.leadChip, notificationPreferences.departureLeadMinutes === minutes ? styles.leadChipActive : null]}>
                  <Text style={[styles.leadText, notificationPreferences.departureLeadMinutes === minutes ? styles.leadTextActive : null]}>{minutes}분 전</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.divider} />
          <SettingsRow variant="toggle" icon="warning-outline" title="지연 알림" subtitle="교통 지연이 커질 때 알려드려요" value={notificationPreferences.delayNotificationEnabled} onToggle={(value) => updatePreferences({ delayNotificationEnabled: value })} />
          <View style={styles.divider} />
          <SettingsRow variant="toggle" icon="map-outline" title="경로 변경 알림" subtitle="재탐색이 필요할 때 알려드려요" value={notificationPreferences.rerouteNotificationEnabled} onToggle={(value) => updatePreferences({ rerouteNotificationEnabled: value })} />
        </SettingsSection>

        <SettingsSection title="앱 설정">
          <SettingsRow variant="toggle" icon="phone-portrait-outline" title="진동" subtitle="알림 진동 사용" value={isVibrationEnabled} onToggle={handleVibrationChange} />
          <View style={styles.divider} />
          <SettingsRow variant="navigation" icon="location-outline" title="위치 권한" summary={locationStatus} onPress={openLocationSettings} />
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
            <View style={styles.divider} />
            <SettingsRow
              variant="danger"
              title="계정 삭제"
              onPress={() => {
                Alert.alert('계정 삭제', '계정과 저장된 루틴·장소를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.', [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => void deleteAccount().then(nav.goToLogin).catch(() => Alert.alert('삭제 실패', '잠시 후 다시 시도해 주세요.')),
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
  preferenceGroup: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  preferenceLabel: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  leadWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  leadChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: settingsTokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  leadChipActive: { backgroundColor: settingsTokens.colors.primary, borderColor: settingsTokens.colors.primary },
  leadText: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
  leadTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
