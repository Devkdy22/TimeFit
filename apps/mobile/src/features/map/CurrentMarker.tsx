import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme/theme';
import type { Point2D } from './render-model';

interface CurrentMarkerProps {
  point: Point2D;
}

export const CurrentMarker = memo(function CurrentMarker({ point }: CurrentMarkerProps) {
  return (
    <View style={[styles.wrapper, { left: point.x - 8, top: point.y - 8 }]}>
      <View style={styles.inner} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: theme.radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.elevation.sm,
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.primary,
  },
});

