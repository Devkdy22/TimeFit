export type RoutineDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type Routine = {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  targetTime: string;
  timeMode: 'arrival' | 'departure';
  repeatDays: RoutineDay[];
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  favorite: boolean;
  lastUsedAt?: string;
};
