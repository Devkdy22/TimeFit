export type RouteSegment = {
  mode: 'walk' | 'bus' | 'subway';
  durationMinutes: number;
  lineLabel?: string;
  startName?: string;
  endName?: string;
  distanceMeters?: number;
  stationCount?: number;
  passStops?: string[];
  directionLabel?: string;
  transferTip?: string;
  realtimeEtaMinutes?: number;
  realtimeEtaSeconds?: number;
  realtimeUpdatedAt?: string;
  realtimeStatus?: 'SCHEDULED' | 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';
  realtimeReasonCode?: string;
  candidates?: Array<{
    route: string;
    etaMinutes: number;
    etaSeconds?: number;
    direction?: string;
  }>;
};

export interface SelectedRouteSummary {
  id: string;
  name: string;
  departure: string;
  arrival: string;
  totalDuration: string;
  totalFareText: string;
  buffer: string;
  transportSummary: string;
  stabilityLabel: string;
  reason: string;
  segments: RouteSegment[];
}
