import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { settingsTokens } from './tokens';
import { useNavigationHelper } from '../../utils/navigation';

interface SimpleSettingsInfoScreenProps {
  title: string;
  description: string;
}

export function SimpleSettingsInfoScreen({ title, description }: SimpleSettingsInfoScreenProps) {
  const nav = useNavigationHelper();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={nav.goBack} style={styles.headerButton}><Ionicons name="chevron-back" size={22} color={settingsTokens.colors.textPrimary} /></Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerButton} />
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.desc}>{description}</Text>
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
  card: { borderRadius: settingsTokens.radius.xl, borderWidth: 1, borderColor: settingsTokens.colors.border, backgroundColor: '#FFF', padding: 18 },
  desc: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.body },
});
