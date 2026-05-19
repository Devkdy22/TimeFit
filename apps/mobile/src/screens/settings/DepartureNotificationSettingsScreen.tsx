import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationPreview } from '../../components/settings/NotificationPreview';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

const times = ['출발 5분 전', '출발 10분 전', '출발 15분 전', '출발 20분 전', '직접 설정'];

export function DepartureNotificationSettingsScreen() {
  const nav = useNavigationHelper();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>출발 알림</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection title="알림 사용">
          <View style={styles.row}><Text style={styles.rowText}>출발 알림</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
        </SettingsSection>

        <SettingsSection title="알림 시간">
          {times.map((label, index) => (
            <Pressable key={label} style={styles.optionRow}>
              <View style={styles.radio}>{index === 0 ? <View style={styles.radioIn} /> : null}</View>
              <Text style={styles.rowText}>{label}</Text>
            </Pressable>
          ))}
        </SettingsSection>

        <SettingsSection title="알림 방식">
          <View style={styles.row}><Text style={styles.rowText}>Push notification</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.rowText}>Vibration</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.rowText}>Sound</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
        </SettingsSection>

        <SettingsSection title="미리보기">
          <View style={styles.previewWrap}>
            <NotificationPreview title="곧 출발 시간이에요!" message="집 -> 회사 이동을 시작해보세요" />
          </View>
        </SettingsSection>

        <Pressable style={styles.helpLink}><Text style={styles.helpText}>알림이 오지 않나요?</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: settingsTokens.colors.background },
  header: { minHeight: 52, paddingHorizontal: settingsTokens.spacing.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  content: { paddingHorizontal: settingsTokens.spacing.screenX, paddingBottom: 36, gap: settingsTokens.spacing.sectionGap },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  rowText: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  optionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: settingsTokens.colors.primary, alignItems: 'center', justifyContent: 'center' },
  radioIn: { width: 10, height: 10, borderRadius: 5, backgroundColor: settingsTokens.colors.primary },
  divider: { height: 1, backgroundColor: settingsTokens.colors.border, marginLeft: 16 },
  previewWrap: { padding: 12 },
  helpLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  helpText: { color: settingsTokens.colors.primary, ...settingsTokens.typography.body },
});
