import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme/theme';
import type { Point2D } from './render-model';

interface NextActionMarkerProps {
  point: Point2D;
}

export const NextActionMarker = memo(function NextActionMarker({ point }: NextActionMarkerProps) {
  return (
    <View style={[styles.wrapper, { left: point.x - 9, top: point.y - 9 }]}>
      <View style={styles.inner} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: 18,
    height: 18,
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
    backgroundColor: theme.colors.accent.warning,
  },
});

