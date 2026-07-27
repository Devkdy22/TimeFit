import type { TimeyState } from '../../domain/timey/timeyTypes';

export type TimeyOverlayIcon =
  | 'search-outline'
  | 'footsteps-outline'
  | 'bus-outline'
  | 'train-outline'
  | 'swap-horizontal-outline'
  | 'alert-circle-outline'
  | 'warning-outline'
  | 'git-compare-outline'
  | 'checkmark-circle-outline';

export interface TimeyOverlayDefinition {
  icon: TimeyOverlayIcon;
  color: string;
  label: string;
}

const OVERLAYS: Partial<Record<TimeyState, TimeyOverlayDefinition>> = {
  searching: { icon: 'search-outline', color: '#4F7686', label: '경로 검색 중' },
  walking: { icon: 'footsteps-outline', color: '#4F9A92', label: '도보 이동 중' },
  riding_bus: { icon: 'bus-outline', color: '#4F7686', label: '버스 이동 중' },
  riding_subway: { icon: 'train-outline', color: '#4F7686', label: '지하철 이동 중' },
  transfer: { icon: 'swap-horizontal-outline', color: '#B7791F', label: '환승 방향 확인 중' },
  warning: { icon: 'alert-circle-outline', color: '#B7791F', label: '주의 상태' },
  urgent: { icon: 'warning-outline', color: '#C05621', label: '긴급 상태' },
  rerouting: { icon: 'git-compare-outline', color: '#4F7686', label: '경로 재탐색 중' },
  success: { icon: 'checkmark-circle-outline', color: '#258A76', label: '도착 완료' },
};

export function getTimeyStatusOverlay(state: TimeyState) {
  return OVERLAYS[state] ?? null;
}
