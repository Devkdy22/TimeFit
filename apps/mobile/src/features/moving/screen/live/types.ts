import type { UiStatus } from '../../../../theme/status-config';

export type TransitMode = 'walk' | 'bus' | 'subway';
export type TransitRealtimeStatus = 'SCHEDULED' | 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';
export type TransitRealtimeSource = 'SEOUL_API' | 'GYEONGGI_API' | 'INCHEON_API' | 'CACHE';

export interface TransitLineItem {
  id: string;
  sourceSegmentIndex: number;
  displaySegmentIndex: number;
  mode: TransitMode;
  lineLabel: string;
  etaText: string;
  stopName: string;
  boardingStopName?: string;
  transferTip?: string;
  isCurrent: boolean;
  realtimeStatus?: TransitRealtimeStatus;
  realtimeUpdatedAt?: string;
  matchingConfidence?: number;
  realtimeSource?: TransitRealtimeSource;
}

export interface LiveSheetProps {
  status: UiStatus;
  currentTime: string;
  arrivalTime: string;
  remainingTime: string;
  mainAction: string;
  stageText: string;
  supportText: string;
  upcomingActionTitle: string;
  upcomingActionSubtitle: string;
  detailLines: TransitLineItem[];
  onRefreshPosition?: () => void;
  onReroute?: () => void;
  onStop?: () => void;
}
