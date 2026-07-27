export type RoutineDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type Routine = {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  targetTime: string;
  timeMode: 'arrival' | 'departure';
  bufferMinutes: number;
  preferredMode: 'any' | 'walk' | 'bus' | 'subway' | 'mixed';
  excludedDates: string[];
  repeatDays: RoutineDay[];
  notificationEnabled: boolean;
  notificationMinutesBefore: number;
  favorite: boolean;
  active: boolean;
  lastUsedAt?: string;
};
