import type { BaseUiProps } from './types';
import { TransportChip } from './TransportChip';

export type RouteMode = 'bus' | 'subway';

export interface RoutePillProps extends Omit<BaseUiProps, 'children'> {
  mode: RouteMode;
  line: string;
}

export function RoutePill({ mode, line }: RoutePillProps) {
  const prefix = mode === 'bus' ? '버스' : '지하철';
  const summary = `${prefix} ${line}`;

  return <TransportChip summary={summary} />;
}
