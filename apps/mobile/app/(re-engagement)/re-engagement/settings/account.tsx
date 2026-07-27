import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../../src/features/auth/context';
import { useNavigationHelper } from '../../../../src/utils/navigation';
import { settingsTokens } from '../../../../src/screens/settings/tokens';

export default function AccountDetailPage() {
  const nav = useNavigationHelper();
  const { profile, deleteAccount } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>계정 정보</Text>
        <View style={styles.headerButton} />
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>이름</Text>
          <Text style={styles.value}>{profile?.name ?? '이름 없음'}</Text>
          <Text style={styles.label}>이메일</Text>
          <Text style={styles.value}>{profile?.email ?? '이메일 정보 없음'}</Text>
          <Text style={styles.label}>로그인 제공자</Text>
          <Text style={styles.value}>{profile?.provider ?? '소셜 로그인'}</Text>
        </View>
        <Pressable
          style={styles.deleteButton}
          onPress={() => Alert.alert('계정 삭제', '계정과 저장된 루틴·장소를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => void deleteAccount().then(nav.goToLogin).catch(() => Alert.alert('삭제 실패', '잠시 후 다시 시도해 주세요.')) },
          ])}
        >
          <Text style={styles.deleteText}>계정 삭제</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: settingsTokens.colors.background },
  header: { minHeight: 52, paddingHorizontal: settingsTokens.spacing.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  content: { paddingHorizontal: settingsTokens.spacing.screenX, gap: 18 },
  card: { borderRadius: settingsTokens.radius.xl, borderWidth: 1, borderColor: settingsTokens.colors.border, backgroundColor: '#FFF', padding: 18, gap: 6 },
  label: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption, marginTop: 8 },
  value: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.body },
  deleteButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#F3B7B7' },
  deleteText: { color: '#C44747', ...settingsTokens.typography.rowTitle },
});
