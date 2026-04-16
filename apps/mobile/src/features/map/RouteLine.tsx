import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme/theme';
import type { Segment } from './render-model';

interface RouteLineProps {
  segments: Segment[];
  progress: number;
}

export const RouteLine = memo(function RouteLine({ segments, progress }: RouteLineProps) {
  const progressCutoff = progress * segments.length;

  return (
    <>
      {segments.map((segment, index) => (
        <View
          key={`route-segment-${index}`}
          style={[
            styles.segment,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              transform: [{ rotate: `${segment.angle}deg` }],
              backgroundColor:
                index < progressCutoff ? theme.colors.accent.primary : 'rgba(106, 184, 255, 0.28)',
            },
          ]}
        />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  segment: {
    position: 'absolute',
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.primary,
  },
});
