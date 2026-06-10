export type TimeyState =
  | 'idle'
  | 'searching'
  | 'confident'
  | 'waiting'
  | 'walking'
  | 'riding_bus'
  | 'riding_subway'
  | 'transfer'
  | 'warning'
  | 'urgent'
  | 'panic'
  | 'offroute'
  | 'rerouting'
  | 'success'
  | 'late';

export interface TimeyContext {
  tripStatus?: string;
  bufferMinutes?: number;
  delayMinutes?: number;
  delayRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  isOffRoute?: boolean;
  isRerouting?: boolean;
  currentMode?: 'WALK' | 'BUS' | 'SUBWAY';
  nextDepartureMinutes?: number | null;
  hasRealtime?: boolean;
  accuracyMeters?: number | null;
  isSearching?: boolean;
  hasRouteSelected?: boolean;
}

export interface TimeyTransitionSnapshot {
  state: TimeyState;
  changedAtMs: number;
}
