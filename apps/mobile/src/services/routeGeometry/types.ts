export interface LatLng {
  latitude: number;
  longitude: number;
}

export type TransportMode = 'WALK' | 'BUS' | 'SUBWAY';

export type GeometrySource =
  | 'kakao-directions'
  | 'seoul-bus-routepath'
  | 'public-data-bus'
  | 'subway-geojson'
  | 'gtfs-shapes'
  | 'fallback-passstops'
  | 'fallback-two-points';

export interface SegmentGeometry {
  segmentId: string;
  mode: TransportMode;
  coordinates: LatLng[];
  source: GeometrySource;
  pointCount: number;
  color: string;
  isDashed: boolean;
}

export interface RouteSegment {
  segmentId: string;
  mode: TransportMode;
  startCoord: LatLng;
  endCoord: LatLng;

  // BUS
  busRouteId?: string;
  busRouteNm?: string;
  busColor?: string;
  startStopId?: string;
  endStopId?: string;
  startStopCoord?: LatLng;
  endStopCoord?: LatLng;
  passStops?: Array<{ name: string; coord: LatLng; localStopId?: string }>;

  // SUBWAY
  subwayLineName?: string;
  subwayLineColor?: string;
  startStationName?: string;
  endStationName?: string;
  startStationCoord?: LatLng;
  endStationCoord?: LatLng;
}
