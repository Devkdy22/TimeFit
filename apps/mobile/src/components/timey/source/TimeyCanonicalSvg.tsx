import { memo } from 'react';
import { Timi } from '../../character/Timi';
import type { TimiAnimatedGroupProps } from '../../character/TimiBase';
import type { TimeyState } from '../../../domain/timey/timeyTypes';

function mapExpression(state: TimeyState): 'neutral' | 'question' | 'focus' | 'smile' | 'concerned' {
  switch (state) {
    case 'success':
    case 'confident':
      return 'smile';
    case 'searching':
    case 'rerouting':
    case 'transfer':
      return 'question';
    case 'walking':
    case 'riding_bus':
    case 'riding_subway':
      return 'focus';
    case 'warning':
    case 'urgent':
    case 'panic':
    case 'offroute':
    case 'late':
      return 'concerned';
    case 'waiting':
    case 'idle':
    default:
      return 'neutral';
  }
}

function mapTone(state: TimeyState): 'mint' | 'orange' | 'red' {
  if (state === 'warning' || state === 'transfer') return 'orange';
  if (state === 'urgent' || state === 'panic' || state === 'offroute' || state === 'late') return 'red';
  return 'mint';
}

interface Props {
  state: TimeyState;
  size: number;
  blink?: number;
  headRotateDeg?: number;
  bodyTranslateY?: number;
  rightArmAnimatedProps?: TimiAnimatedGroupProps;
}

function BaseTimeyCanonicalSvg({ state, size, blink = 1, headRotateDeg = 0, bodyTranslateY = 0, rightArmAnimatedProps }: Props) {
  return <Timi size={size} expression={mapExpression(state)} tone={mapTone(state)} blink={blink} headRotateDeg={headRotateDeg} bodyTranslateY={bodyTranslateY} rightArmAnimatedProps={rightArmAnimatedProps} />;
}

export const TimeyCanonicalSvg = memo(BaseTimeyCanonicalSvg);
