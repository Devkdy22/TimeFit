import type { RouteCandidate } from '../../recommendation/types/recommendation.types';

export interface RoutineLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface RoutineEntity {
  id: string;
  userId: string;
  title: string;
  origin: RoutineLocation;
  destination: RoutineLocation;
  weekdays: number[]; // 0(Sun) ~ 6(Sat)
  arrivalTime: string; // HH:mm
  savedRoute?: RouteCandidate;
  expoPushToken?: string;
  active: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}
