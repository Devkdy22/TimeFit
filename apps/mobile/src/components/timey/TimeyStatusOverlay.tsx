import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { TimeyState } from '../../domain/timey/timeyTypes';
import { getTimeyStatusOverlay } from './timeyOverlay';

export function TimeyStatusOverlay({ state, size }: { state: TimeyState; size: number }) {
  const overlay = getTimeyStatusOverlay(state);
  if (!overlay) return null;

  const iconSize = Math.max(14, Math.min(20, size * 0.17));
  return (
    <View
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel={overlay.label}
      style={[styles.badge, { borderColor: `${overlay.color}55` }]}
    >
      <Ionicons name={overlay.icon} size={iconSize} color={overlay.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 4,
    right: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#18323A',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
