import { Pressable, StyleSheet, Text } from 'react-native';
import { appColors, appSpacing, appTypography } from '../../theme/app-tokens';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, disabled ? styles.disabled : null, { opacity: pressed ? 0.88 : 1 }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: appSpacing.radiusLG,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  disabled: {
    backgroundColor: '#B8D7D5',
  },
  label: {
    color: '#FFFFFF',
    ...appTypography.cardTitle,
  },
});
