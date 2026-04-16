import type { UiStatus } from '../../theme/status-config';

export interface QuickDestination {
  id: string;
  name: string;
  actionHint: string;
}

export interface RouteItem {
  id: string;
  name: string;
  summary: string;
  eta: string;
}

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description: string;
  status: UiStatus;
}

export interface RoutineItem {
  id: string;
  title: string;
  hint: string;
}

export interface RecentDestination {
  id: string;
  name: string;
  hint: string;
}
