export interface OdsayApiError {
  code: number;
  message: string;
}

export interface OdsayLane {
  name?: string;
  busNo?: string;
  busID?: string | number;
  busLocalBlID?: string | number;
  subwayCode?: string | number;
  subwayID?: string | number;
}

export interface OdsaySubPath {
  trafficType: number | string;
  sectionTime?: number;
  distance?: number;
  stationCount?: number;
  lane?: OdsayLane[];
  startName?: string;
  endName?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  startID?: string | number;
  endID?: string | number;
  startArsID?: string | number;
  endArsID?: string | number;
  stationID?: string | number;
  stationID2?: string | number;
  wayCode?: number;
  passStopList?: {
    stations?: Array<{
      stationName?: string;
      stationID?: string | number;
      stationId?: string | number;
      arsID?: string | number;
      arsId?: string | number;
      localStationID?: string | number;
      x?: string | number;
      y?: string | number;
    }>;
  };
}

export interface OdsayPathInfo {
  totalTime?: number;
  payment?: number;
}

export interface OdsayPath {
  pathType?: number;
  info?: OdsayPathInfo;
  subPath?: OdsaySubPath[];
}

export interface OdsayResult {
  path?: OdsayPath[];
  error?: {
    code?: number;
    msg?: string;
    message?: string;
  };
}

export interface OdsayTransitResponse {
  result?: OdsayResult;
  error?: {
    code?: number;
    msg?: string;
    message?: string;
  };
}

export type OdsayFetchStatus =
  | 'OK'
  | 'NO_RESULT'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_DOWN'
  | 'INVALID_INPUT';

export interface OdsayTransitRouteResult {
  status: OdsayFetchStatus;
  paths: OdsayPath[];
  fetchedAt: string;
  cacheableForMs: number;
  error?: OdsayApiError;
  providerHttpStatus?: number;
  meta?: {
    cacheHit?: boolean;
    staleFallback?: boolean;
    deduplicated?: boolean;
  };
}

export interface OdsayUsageSnapshot {
  date: string;
  timezone: string;
  totalRequests: number;
  externalApiCalls: number;
  cacheHits: number;
  staleFallbackHits: number;
  deduplicatedRequests: number;
  successResponses: number;
  failedResponses: number;
}

export interface KakaoPolylineSegment {
  mode: 'walk' | 'bus' | 'subway';
  points: Array<{ lat: number; lng: number }>;
}

export interface KakaoMapMarker {
  id: string;
  type: 'origin' | 'destination' | 'transfer';
  label: string;
  lat: number;
  lng: number;
}

export interface KakaoMapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface KakaoMapOverlay {
  polylineSegments: KakaoPolylineSegment[];
  markers: KakaoMapMarker[];
  bounds: KakaoMapBounds;
}
