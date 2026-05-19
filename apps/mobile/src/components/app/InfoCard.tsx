import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { appColors, appSpacing } from '../../theme/app-tokens';

interface InfoCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function InfoCard({ children, style }: InfoCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: appColors.card,
    borderWidth: 1,
    borderColor: '#E6F0F0',
    padding: appSpacing.cardPadding,
    shadowColor: '#0A1D1C',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
