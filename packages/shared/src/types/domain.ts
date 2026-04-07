export interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RecommendationSummary {
  arrivalAt: string;
  departureAt: string;
  totalMinutes: number;
  lateRisk: boolean;
}

export type TransportMode = 'walk' | 'transit' | 'car' | 'mixed';
