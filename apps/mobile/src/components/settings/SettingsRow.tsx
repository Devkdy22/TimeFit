import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { settingsTokens } from '../../screens/settings/tokens';

type BaseProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

type NavigationRowProps = BaseProps & {
  variant: 'navigation';
  summary?: string;
  onPress: () => void;
};

type ToggleRowProps = BaseProps & {
  variant: 'toggle';
  value: boolean;
  onToggle: (next: boolean) => void;
};

type DangerRowProps = {
  variant: 'danger';
  title: string;
  onPress: () => void;
};

export type SettingsRowProps = NavigationRowProps | ToggleRowProps | DangerRowProps;

export function SettingsRow(props: SettingsRowProps) {
  if (props.variant === 'danger') {
    return (
      <Pressable onPress={props.onPress} style={({ pressed }) => [styles.rowBase, { opacity: pressed ? 0.82 : 1 }]}>
        <Text style={styles.dangerText}>{props.title}</Text>
      </Pressable>
    );
  }

  const content = (
    <>
      <View style={styles.leftWrap}>
        <View style={styles.iconWrap}>
          <Ionicons name={props.icon} size={18} color={settingsTokens.colors.textSecondary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
        </View>
      </View>

      {props.variant === 'navigation' ? (
        <View style={styles.rightWrap}>
          {props.summary ? <Text style={styles.summary}>{props.summary}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color={settingsTokens.colors.textMuted} />
        </View>
      ) : (
        <Switch value={props.value} onValueChange={props.onToggle} trackColor={{ false: '#D7E6E6', true: '#9BE3DE' }} thumbColor="#FFFFFF" />
      )}
    </>
  );

  if (props.variant === 'navigation') {
    return (
      <Pressable onPress={props.onPress} style={({ pressed }) => [styles.rowBase, { opacity: pressed ? 0.86 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.rowBase}>{content}</View>;
}

const styles = StyleSheet.create({
  rowBase: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: settingsTokens.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  title: { color: settingsTokens.colors.textPrimary, ...settingsTokens.typography.rowTitle },
  subtitle: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.caption },
  rightWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { color: settingsTokens.colors.textSecondary, ...settingsTokens.typography.body },
  dangerText: { color: settingsTokens.colors.danger, ...settingsTokens.typography.rowTitle },
});
