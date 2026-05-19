import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

interface Props {
  onCurrent: () => void;
  onOverview: () => void;
  bottomOffset: number;
}

export function FloatingMapControls({ onCurrent, onOverview, bottomOffset }: Props) {
  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]}>
      <Pressable style={styles.fab} onPress={onCurrent}>
        <Ionicons name="locate" size={20} color="#0F172A" />
      </Pressable>
      <Pressable style={styles.fab} onPress={onOverview}>
        <Ionicons name="map-outline" size={20} color="#0F172A" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, gap: 10, zIndex: 20 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
});
