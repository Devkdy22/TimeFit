import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import type { TimeyState } from '../../domain/timey/timeyTypes';
import type { TimeyProps } from '../../types/timey.types';
import { Timey } from './Timey';
import { TimeyStatusOverlay } from './TimeyStatusOverlay';
import {
  TIMEY_STAGE_TOKENS,
  resolveTimeyStageMetrics,
  type TimeyStageVariant,
} from './timeyDisplay';

export interface TimeyStageProps extends Omit<TimeyProps, 'size'> {
  variant: TimeyStageVariant;
  state?: TimeyState;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
  /** Contexts such as the home input hero can suppress state badges while retaining the state model. */
  showOverlay?: boolean;
  /** Development QA hook; called once for the Stage lifetime. */
  onStageMount?: () => void;
}

/** Stable Stage: layout owns the baseline; the renderer only owns contained motion. */
export function TimeyStage({ variant, state = 'idle', style, maxWidth = 220, showOverlay = true, onStageMount, ...timeyProps }: TimeyStageProps) {
  const { width: windowWidth } = useWindowDimensions();
  const token = TIMEY_STAGE_TOKENS[variant];
  const availableWidth = Math.min(Math.max(1, windowWidth), maxWidth);
  const metrics = useMemo(() => resolveTimeyStageMetrics(availableWidth, variant), [availableWidth, variant]);
  const didNotifyMount = useRef(false);

  useEffect(() => {
    if (didNotifyMount.current) return;
    didNotifyMount.current = true;
    onStageMount?.();
  }, [onStageMount]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={timeyProps.accessibilityLabel}
      style={[
        styles.stage,
        {
          width: '100%',
          maxWidth,
          height: metrics.height,
          minHeight: token.minHeight,
          maxHeight: token.maxHeight,
          paddingHorizontal: token.horizontalPadding,
          paddingBottom: token.baselineOffset,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <Timey {...timeyProps} state={state} size={metrics.size} />
      </View>
      {showOverlay ? <TimeyStatusOverlay state={state} size={metrics.size} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 1,
  },
});
