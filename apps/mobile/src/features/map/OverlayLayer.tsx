import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface OverlayLayerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const OverlayLayer = memo(function OverlayLayer({ children, style }: OverlayLayerProps) {
  return (
    <View pointerEvents="box-none" style={[styles.overlay, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
});

