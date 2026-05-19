import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

export function EmergencyNotificationSettingsScreen() {
  const nav = useNavigationHelper();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>긴급 알림</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}><Text style={styles.title}>긴급 알림 사용</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.title}>지연 알림</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.title}>경로 변경 알림</Text><Switch value trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFF" /></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: settingsTokens.colors.background },
  header: { minHeight: 52, paddingHorizontal: settingsTokens.spacing.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  content: { paddingHorizontal: settingsTokens.spacing.screenX, paddingBottom: 36 },
  card: { borderRadius: settingsTokens.radius.xl, borderWidth: 1, borderColor: settingsTokens.colors.border, backgroundColor: '#FFF' },
  row: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  divider: { height: 1, backgroundColor: settingsTokens.colors.border, marginLeft: 16 },
});
