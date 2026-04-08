export type TripStatus =
  | 'preparing'
  | 'moving'
  | 'caution'
  | 'urgent'
  | 'rerouting'
  | 'arrived';

export type TripUrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type TripLiveStatus = '여유' | '주의' | '긴급' | '위험';

export interface TripEntity {
  id: string;
  userId: string;
  recommendationId: string;
  status: TripStatus;
  startedAt: string;
  currentRoute: string;
  departureAt: string;
  arrivalAt: string;
  expoPushToken?: string;
  plannedDurationMinutes: number;
  expectedArrivalAt: string;
  delayOffsetMinutes: number;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  stationName?: string;
}

export interface TripLiveSnapshot {
  remainingMinutes: number;
  bufferMinutes: number;
  estimatedArrivalAt: string;
  currentStatus: TripLiveStatus;
  nextAction: string;
  urgencyLevel: TripUrgencyLevel;
  delayMinutes: number;
}
