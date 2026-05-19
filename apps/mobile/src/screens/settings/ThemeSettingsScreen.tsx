import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

const options = ['라이트', '다크', '시스템'];

export function ThemeSettingsScreen() {
  const nav = useNavigationHelper();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>테마 설정</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {options.map((item, index) => (
            <Pressable key={item} style={styles.optionRow}>
              <Text style={styles.optionText}>{item}</Text>
              <View style={styles.radio}>{item === '시스템' ? <View style={styles.radioIn} /> : null}</View>
              {index < options.length - 1 ? <View style={styles.divider} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: settingsTokens.colors.background },
  header: { minHeight: 52, paddingHorizontal: settingsTokens.spacing.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.sectionTitle },
  content: { paddingHorizontal: settingsTokens.spacing.screenX },
  card: { borderRadius: settingsTokens.radius.xl, borderWidth: 1, borderColor: settingsTokens.colors.border, backgroundColor: '#FFF', overflow: 'hidden' },
  optionRow: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: settingsTokens.colors.primary, alignItems: 'center', justifyContent: 'center' },
  radioIn: { width: 10, height: 10, borderRadius: 5, backgroundColor: settingsTokens.colors.primary },
  divider: { position: 'absolute', left: 16, right: 16, bottom: 0, height: 1, backgroundColor: settingsTokens.colors.border },
});
