import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme/theme';
import type { Segment } from './render-model';
import { segmentProgressByLengths } from './routeLineProgress';

interface RouteLineProps {
  segments: Segment[];
  progress: number;
}

export const RouteLine = memo(function RouteLine({ segments, progress }: RouteLineProps) {
  const segmentLengths = segments.map((segment) => segment.width);

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
            },
          ]}
        >
          <View style={styles.remainingSegment} />
          <View
            style={[
              styles.completedSegment,
              { width: segment.width * segmentProgressByLengths(index, progress, segmentLengths) },
            ]}
          />
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  segment: {
    position: 'absolute',
    height: 4,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  remainingSegment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(106, 184, 255, 0.28)',
  },
  completedSegment: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.primary,
  },
});
