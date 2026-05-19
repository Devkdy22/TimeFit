import type { UiStatus } from '../../../../theme/status-config';

export type TransitMode = 'walk' | 'bus' | 'subway';

export interface TransitLineItem {
  id: string;
  mode: TransitMode;
  lineLabel: string;
  etaText: string;
  stopName: string;
  isCurrent: boolean;
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
}
