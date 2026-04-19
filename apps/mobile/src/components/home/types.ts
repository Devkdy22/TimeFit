export type CommuteStatus = 'relaxed' | 'warning' | 'urgent';

export interface RecentDestination {
  id: string;
  name: string;
  subtitle: string;
  time: string;
}
