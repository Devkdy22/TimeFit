import { Pressable, StyleSheet, Text } from 'react-native';
import { appColors, appSpacing, appTypography } from '../../theme/app-tokens';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
}

export function SecondaryButton({ label, onPress }: SecondaryButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { opacity: pressed ? 0.76 : 1 }]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: appSpacing.radiusLG,
    borderWidth: 1,
    borderColor: appColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primaryLight,
    paddingHorizontal: 18,
  },
  label: {
    color: appColors.primaryDark,
    ...appTypography.body,
  },
});
