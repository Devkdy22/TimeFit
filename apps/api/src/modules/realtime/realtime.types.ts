export type RealtimeStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'CHECKING' | 'UNAVAILABLE';

export type RealtimeType = 'BUS' | 'SUBWAY';

export type RealtimeSource = 'SEOUL_API' | 'CACHE';

export type RealtimeReasonCode =
  | 'BUS_STOP_NOT_MATCHED'
  | 'BUS_ROUTE_NOT_FOUND'
  | 'BUS_API_TIMEOUT'
  | 'BUS_EMPTY_RESPONSE'
  | 'SUBWAY_STATION_NOT_MATCHED'
  | 'SUBWAY_LINE_NOT_SUPPORTED'
  | 'SUBWAY_API_TIMEOUT'
  | 'SUBWAY_EMPTY_RESPONSE'
  | 'CACHE_STALE_USED';

export interface RealtimeEtaResponse {
  type: RealtimeType;
  status: RealtimeStatus;
  etaMinutes: number | null;
  source: RealtimeSource;
  reasonCode: RealtimeReasonCode | null;
  updatedAt: string;
}

export interface BusEtaQuery {
  stationId?: string;
  routeId?: string;
  arsId?: string;
  stationName?: string;
  lat?: number;
  lng?: number;
  routeNo?: string;
}

export interface SubwayEtaQuery {
  line: string;
  station: string;
}
