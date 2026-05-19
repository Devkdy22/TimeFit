import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { useAuth } from '../../features/auth/context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

export function SettingsScreen() {
  const nav = useNavigationHelper();
  const { isLoggedIn, logout } = useAuth();
  const [isVibrationEnabled, setVibrationEnabled] = useState(true);
  const [departureLeadTime] = useState('5분 전');
  const [routineAlertEnabled] = useState(true);
  const [emergencyAlertEnabled] = useState(true);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ProfileCard
          name={isLoggedIn ? '김도연' : '게스트'}
          email={isLoggedIn ? 'kim@timefit.app' : '로그인 후 계정 동기화'}
          providerLabel={isLoggedIn ? 'Google 로그인' : '로그인 필요'}
          onPress={nav.goToSettingsAccount}
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
});
